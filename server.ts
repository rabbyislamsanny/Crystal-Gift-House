import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AppModule,
  Order,
  PermissionAction,
  Product,
  RolePermissionMap,
  UserAccount,
  UserRole,
} from './src/types/database';
import {
  getDefaultRolePermissions,
  hasPermission,
  validateUserModification,
} from './src/utils/authSecurity';
import {
  parseBatchOrderText,
  parseOrderText,
  ParsedOrderDraft,
  recalculateAndValidateDraft,
  matchProductFromCatalogue,
} from './src/utils/aiOrderParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Helper to resolve actor and role permissions from request headers/body
  function extractAuthContext(req: Request): {
    actor: Pick<UserAccount, 'id' | 'username' | 'role' | 'isActive' | 'customPermissions'>;
    rolePermissions: RolePermissionMap;
  } {
    const headerUserId = (req.headers['x-user-id'] as string) || req.body?.actor?.id || 'user-1';
    const headerUsername = (req.headers['x-user-username'] as string) || req.body?.actor?.username || 'admin';
    const headerRole = ((req.headers['x-user-role'] as string) || req.body?.actor?.role || 'super_admin') as UserRole;
    const headerActive = req.headers['x-user-active'] !== 'false' && req.body?.actor?.isActive !== false;

    const rolePermissions: RolePermissionMap =
      req.body?.rolePermissions || getDefaultRolePermissions();

    return {
      actor: {
        id: headerUserId,
        username: headerUsername,
        role: headerRole,
        isActive: headerActive,
        customPermissions: req.body?.actor?.customPermissions,
      },
      rolePermissions,
    };
  }

  function requireBackendPermission(module: AppModule, action: PermissionAction) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { actor, rolePermissions } = extractAuthContext(req);
      if (!hasPermission(actor, rolePermissions, module, action)) {
        res.status(403).json({
          success: false,
          error: `Backend RBAC Denied: Role "${actor.role}" lacks "${action}" permission on module "${module}".`,
        });
        return;
      }
      next();
    };
  }

  // Health & AI availability status endpoint (never exposes secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    const rawKey = process.env.GEMINI_API_KEY || '';
    const hasConfiguredGeminiKey =
      Boolean(rawKey) && rawKey !== 'MY_GEMINI_API_KEY' && rawKey.length > 10;
    res.json({
      status: 'ok',
      aiConfigured: hasConfiguredGeminiKey,
      aiModel: hasConfiguredGeminiKey ? 'gemini-3.8-flash' : 'rule_engine_fallback',
      timezone: 'Asia/Dhaka',
      currency: 'BDT',
    });
  });

  // Backend RBAC permission verification endpoint
  app.post('/api/rbac/verify', (req: Request, res: Response) => {
    const { module, action } = req.body as { module: AppModule; action: PermissionAction };
    const { actor, rolePermissions } = extractAuthContext(req);
    const allowed = hasPermission(actor, rolePermissions, module, action);
    if (!allowed) {
      res.status(403).json({
        allowed: false,
        error: `Backend RBAC Denied: Role "${actor.role}" is not permitted to perform "${action}" in "${module}".`,
      });
      return;
    }
    res.json({ allowed: true, role: actor.role, module, action });
  });

  // Backend User Modification Security Validator
  app.post(
    '/api/users/validate-modification',
    requireBackendPermission('users', 'edit'),
    (req: Request, res: Response) => {
      const { actor, rolePermissions } = extractAuthContext(req);
      const { targetUser, allUsers, operation, newRole } = req.body;
      const result = validateUserModification({
        actor,
        rolePermissions,
        targetUser,
        allUsers,
        operation,
        newRole,
      });
      if (!result.allowed) {
        res.status(403).json(result);
        return;
      }
      res.json(result);
    }
  );

  // Server-side AI Auto Order Entry Parser with Gemini 3.8 Flash + Rule Engine Fallback
  app.post(
    '/api/ai/parse-order',
    requireBackendPermission('ai_order_entry', 'create'),
    async (req: Request, res: Response) => {
      try {
        const {
          rawText,
          isBatch,
          catalogue = [],
          existingOrders = [],
          settings = { defaultInsideDhakaFee: 80, defaultOutsideDhakaFee: 120 },
        } = req.body as {
          rawText: string;
          isBatch?: boolean;
          catalogue: Product[];
          existingOrders: Order[];
          settings?: { defaultInsideDhakaFee?: number; defaultOutsideDhakaFee?: number };
        };

        if (!rawText || !rawText.trim()) {
          res.status(400).json({ success: false, error: 'Order text cannot be empty.' });
          return;
        }

        // First run deterministic multilingual rule parser as baseline
        const ruleDrafts: ParsedOrderDraft[] = isBatch
          ? parseBatchOrderText(rawText, catalogue, existingOrders, settings)
          : [parseOrderText(rawText, catalogue, existingOrders, settings)];

        const rawKey = process.env.GEMINI_API_KEY || '';
        const hasConfiguredGeminiKey =
          Boolean(rawKey) && rawKey !== 'MY_GEMINI_API_KEY' && rawKey.length > 10;

        if (!hasConfiguredGeminiKey) {
          res.json({
            success: true,
            parserSource: 'rule_engine',
            drafts: ruleDrafts,
          });
          return;
        }

        // If Gemini API key is configured on the server, enhance extraction with gemini-3.8-flash
        try {
          const ai = new GoogleGenAI({
            apiKey: rawKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const catalogueSummary = catalogue
            .filter((p) => !p.isArchived)
            .map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              banglaName: p.banglaName || '',
              aliases: p.aliases || [],
              sellingPrice: p.sellingPrice,
            }));

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Extract customer order details from the following Bangladesh e-commerce customer message(s).
Accept Bangla, Banglish, and English.
Catalogue products (ONLY match against these; never invent products):
${JSON.stringify(catalogueSummary)}

Rules:
- Never invent missing customer name, phone, or address. Leave empty string if missing.
- Default delivery charge is Inside Dhaka = ${settings?.defaultInsideDhakaFee ?? 80} BDT, Outside Dhaka = ${settings?.defaultOutsideDhakaFee ?? 120} BDT unless specified in the text.
- Customer Text:
${rawText}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING },
                    customerPhone: { type: Type.STRING },
                    fullAddress: { type: Type.STRING },
                    district: { type: Type.STRING },
                    deliveryZone: { type: Type.STRING },
                    discount: { type: Type.NUMBER },
                    deliveryCharge: { type: Type.NUMBER },
                    advancePaid: { type: Type.NUMBER },
                    paymentMethod: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          rawProductText: { type: Type.STRING },
                          matchedProductId: { type: Type.STRING },
                          quantity: { type: Type.NUMBER },
                          unitPrice: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                },
              },
            },
          });

          const parsedJson = JSON.parse(response.text || '[]');
          if (Array.isArray(parsedJson) && parsedJson.length > 0) {
            const aiDrafts: ParsedOrderDraft[] = parsedJson.map((aiItem: any, idx: number) => {
              const fallback = ruleDrafts[idx] || ruleDrafts[0];
              const zone =
                aiItem.deliveryZone === 'outside_dhaka' || aiItem.deliveryZone === 'sub_dhaka'
                  ? aiItem.deliveryZone
                  : aiItem.deliveryZone === 'inside_dhaka'
                  ? 'inside_dhaka'
                  : fallback.deliveryZone;

              const mappedItems = Array.isArray(aiItem.items) && aiItem.items.length > 0
                ? aiItem.items.map((it: any, iIdx: number) => {
                    const directProd = catalogue.find((p) => p.id === it.matchedProductId);
                    const matched = directProd
                      ? { product: directProd, confidence: 'exact' as const }
                      : matchProductFromCatalogue(it.rawProductText || '', catalogue);
                    const prod = matched.product;
                    const qty = Math.max(1, Number(it.quantity) || 1);
                    const price =
                      Number(it.unitPrice) > 0
                        ? Number(it.unitPrice)
                        : prod
                        ? prod.sellingPrice
                        : 0;
                    return {
                      id: `ai-item-${Date.now()}-${idx}-${iIdx}`,
                      rawProductText: it.rawProductText || prod?.name || 'Unknown Product',
                      matchedProductId: prod ? prod.id : null,
                      matchedProductName: prod ? prod.name : it.rawProductText || 'Unmatched Product',
                      matchedSku: prod ? prod.sku : '',
                      quantity: qty,
                      unitPrice: price,
                      cataloguePrice: prod ? prod.sellingPrice : 0,
                      availableStock: prod ? Math.max(0, prod.currentStock - prod.reservedStock) : 0,
                      subtotal: qty * price,
                      confidence: matched.confidence,
                    };
                  })
                : fallback.items;

              const merged: ParsedOrderDraft = {
                ...fallback,
                customerName: aiItem.customerName || fallback.customerName,
                customerPhone: aiItem.customerPhone || fallback.customerPhone,
                fullAddress: aiItem.fullAddress || fallback.fullAddress,
                district: aiItem.district || fallback.district,
                deliveryZone: zone,
                discount: aiItem.discount !== undefined ? Number(aiItem.discount) : fallback.discount,
                deliveryCharge:
                  aiItem.deliveryCharge !== undefined && Number(aiItem.deliveryCharge) > 0
                    ? Number(aiItem.deliveryCharge)
                    : fallback.deliveryCharge,
                advancePaid:
                  aiItem.advancePaid !== undefined ? Number(aiItem.advancePaid) : fallback.advancePaid,
                paymentMethod: aiItem.paymentMethod || fallback.paymentMethod,
                notes: aiItem.notes || fallback.notes,
                items: mappedItems,
                parserSource: 'gemini_ai',
              };

              return recalculateAndValidateDraft(merged, catalogue, existingOrders, settings);
            });

            res.json({
              success: true,
              parserSource: 'gemini_ai',
              drafts: aiDrafts,
            });
            return;
          }
        } catch (_aiErr) {
          // Gracefully fall back to rule-based parser if Gemini API fails or quota is reached
        }

        res.json({
          success: true,
          parserSource: 'rule_engine',
          drafts: ruleDrafts,
        });
      } catch (err: any) {
        res.status(500).json({
          success: false,
          error: err?.message || 'Failed to parse order text.',
        });
      }
    }
  );

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Crystal Gift House Business OS server running on http://0.0.0.0:${PORT}`);
  });
}

// Start server when run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  startServer();
}
