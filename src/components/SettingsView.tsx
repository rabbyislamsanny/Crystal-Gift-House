import React, { useState } from 'react';
import {
  Settings,
  Lock,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  History,
  Building,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AppSettings, AuditLog } from '../types/database';

interface SettingsViewProps {
  settings: AppSettings;
  auditLogs: AuditLog[];
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onExportBackup: () => void;
  onRestoreBackup: (jsonString: string) => { success: boolean; error?: string };
  onResetToDemo: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  auditLogs,
  onUpdateSettings,
  onExportBackup,
  onRestoreBackup,
  onResetToDemo,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'audit' | 'backup'>('general');

  // Form states
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [banglaBusinessName, setBanglaBusinessName] = useState(settings.banglaBusinessName);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [address, setAddress] = useState(settings.address);
  const [defaultExchangeRate, setDefaultExchangeRate] = useState(settings.defaultExchangeRate);
  const [defaultInsideDhakaFee, setDefaultInsideDhakaFee] = useState(settings.defaultInsideDhakaFee);
  const [defaultSubDhakaFee, setDefaultSubDhakaFee] = useState(settings.defaultSubDhakaFee);
  const [defaultOutsideDhakaFee, setDefaultOutsideDhakaFee] = useState(settings.defaultOutsideDhakaFee);
  const [ownerPin, setOwnerPin] = useState(settings.ownerPin);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      businessName,
      banglaBusinessName,
      phone,
      email,
      address,
      defaultExchangeRate,
      defaultInsideDhakaFee,
      defaultSubDhakaFee,
      defaultOutsideDhakaFee,
      ownerPin,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = onRestoreBackup(content);
      if (res.success) {
        setRestoreMessage('Database successfully restored from JSON backup!');
      } else {
        setRestoreMessage('Restore failed: ' + (res.error || 'Invalid file format'));
      }
      setTimeout(() => setRestoreMessage(''), 5000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-700" />
            <span>Settings, Security & System Backup</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure business rates, single-owner PIN credentials, audit trails & full database snapshots
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'general' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
            }`}
          >
            General & Rates
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
            }`}
          >
            Audit Log ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'backup' ? 'bg-white shadow-2xs text-emerald-800' : 'text-slate-600'
            }`}
          >
            Backup & Recovery
          </button>
        </div>
      </div>

      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-5 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Settings updated successfully!</span>
            </div>
          )}

          {/* Business Profile */}
          <div>
            <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-3 text-[11px]">
              Business Profile & Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Company Name (English)</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Bangla Business Name</label>
                <input
                  type="text"
                  value={banglaBusinessName}
                  onChange={(e) => setBanglaBusinessName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Official Hotline / WhatsApp</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">Physical Store / Warehouse Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>
            </div>
          </div>

          {/* Logistics Delivery Rates & Default Exchange Rate */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-3 text-[11px]">
              Currency Exchange Rate & Delivery Fee Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Default Ad Exchange Rate (৳ / $)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={defaultExchangeRate}
                  onChange={(e) => setDefaultExchangeRate(parseFloat(e.target.value) || 122.5)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Inside Dhaka Fee (৳)</label>
                <input
                  type="number"
                  required
                  value={defaultInsideDhakaFee}
                  onChange={(e) => setDefaultInsideDhakaFee(parseFloat(e.target.value) || 70)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Sub-Dhaka Fee (৳)</label>
                <input
                  type="number"
                  required
                  value={defaultSubDhakaFee}
                  onChange={(e) => setDefaultSubDhakaFee(parseFloat(e.target.value) || 100)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Outside Dhaka Fee (৳)</label>
                <input
                  type="number"
                  required
                  value={defaultOutsideDhakaFee}
                  onChange={(e) => setDefaultOutsideDhakaFee(parseFloat(e.target.value) || 130)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Single Owner PIN Security */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-3 text-[11px] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-700" />
              <span>Owner Security PIN (Authorization for Resets & Audits)</span>
            </h3>
            <div className="max-w-xs">
              <input
                type="password"
                maxLength={6}
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono font-bold tracking-widest text-center"
              />
              <p className="text-[10px] text-slate-400 mt-1">Default PIN is 1234. Keep confidential.</p>
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">System Audit Trail</h3>
              <p className="text-xs text-slate-500">Chronological history of product edits, order creations, and financial transactions</p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-sans font-semibold text-slate-700">
                      {log.entity}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-slate-800 max-w-md truncate">
                      {log.details}
                    </td>
                    <td className="px-4 py-2.5 font-sans text-slate-500">
                      {log.performedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-6 text-xs">
          {restoreMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg">
              {restoreMessage}
            </div>
          )}

          {/* Backup Download */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-700" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Download Full Database Backup</h4>
                <p className="text-slate-500 text-xs">
                  Exports complete normalized relational state (Products, Stock movements, Orders, Parcels, Ad spend, Operating expenses, Bank accounts & Audit logs) as clean JSON.
                </p>
              </div>
            </div>
            <button
              onClick={onExportBackup}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
            >
              Export JSON Backup File
            </button>
          </div>

          {/* Restore Upload */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-700" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Restore Database from JSON Backup</h4>
                <p className="text-slate-500 text-xs">
                  Restore previously saved database snapshot. Validates structural schemas before applying.
                </p>
              </div>
            </div>
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
          </div>

          {/* Reset to Demo */}
          <div className="p-4 bg-red-50/50 rounded-xl border border-red-200 space-y-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-600" />
              <div>
                <h4 className="font-bold text-red-950 text-sm">Reset System to Initial Demo Data</h4>
                <p className="text-red-800 text-xs">
                  Re-populates default Crystal Gift House inventory, suppliers, verified orders, and settings.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const pin = prompt('Enter Owner PIN to confirm database reset:');
                if (pin === settings.ownerPin) {
                  onResetToDemo();
                } else if (pin !== null) {
                  alert('Invalid Owner PIN.');
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg cursor-pointer"
            >
              Reset to Demo Database
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
