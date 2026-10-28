export interface DistrictInfo {
  name: string;
  banglaName: string;
  division: string;
  defaultZone: 'inside_dhaka' | 'sub_dhaka' | 'outside_dhaka';
}

export const BANGLADESH_DISTRICTS: DistrictInfo[] = [
  // Dhaka Division
  { name: 'Dhaka', banglaName: 'ঢাকা', division: 'Dhaka', defaultZone: 'inside_dhaka' },
  { name: 'Gazipur', banglaName: 'গাজীপুর', division: 'Dhaka', defaultZone: 'sub_dhaka' },
  { name: 'Narayanganj', banglaName: 'নারায়ণগঞ্জ', division: 'Dhaka', defaultZone: 'sub_dhaka' },
  { name: 'Narsingdi', banglaName: 'নরসিংদী', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Manikganj', banglaName: 'মানিকগঞ্জ', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Munshiganj', banglaName: 'মুন্সীগঞ্জ', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Kishoreganj', banglaName: 'কিশোরগঞ্জ', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Faridpur', banglaName: 'ফরিদপুর', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Gopalganj', banglaName: 'গোপালগঞ্জ', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Madaripur', banglaName: 'মাদারীপুর', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Rajbari', banglaName: 'রাজবাড়ী', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Shariatpur', banglaName: 'শরীয়তপুর', division: 'Dhaka', defaultZone: 'outside_dhaka' },
  { name: 'Tangail', banglaName: 'টাঙ্গাইল', division: 'Dhaka', defaultZone: 'outside_dhaka' },

  // Chattogram Division
  { name: 'Chattogram', banglaName: 'চট্টগ্রাম', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: "Cox's Bazar", banglaName: 'কক্সবাজার', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Cumilla', banglaName: 'কুমিল্লা', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Feni', banglaName: 'ফেনী', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Brahmanbaria', banglaName: 'ব্রাহ্মণবাড়িয়া', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Noakhali', banglaName: 'নোয়াখালী', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Chandpur', banglaName: 'চাঁদপুর', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Lakshmipur', banglaName: 'লক্ষ্মীপুর', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Rangamati', banglaName: 'রাঙ্গামাটি', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Bandarban', banglaName: 'বান্দরবান', division: 'Chattogram', defaultZone: 'outside_dhaka' },
  { name: 'Khagrachhari', banglaName: 'খাগড়াছড়ি', division: 'Chattogram', defaultZone: 'outside_dhaka' },

  // Sylhet Division
  { name: 'Sylhet', banglaName: 'সিলেট', division: 'Sylhet', defaultZone: 'outside_dhaka' },
  { name: 'Moulvibazar', banglaName: 'মৌলভীবাজার', division: 'Sylhet', defaultZone: 'outside_dhaka' },
  { name: 'Habiganj', banglaName: 'হবিগঞ্জ', division: 'Sylhet', defaultZone: 'outside_dhaka' },
  { name: 'Sunamganj', banglaName: 'সুনামগঞ্জ', division: 'Sylhet', defaultZone: 'outside_dhaka' },

  // Rajshahi Division
  { name: 'Rajshahi', banglaName: 'রাজশাহী', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Bogura', banglaName: 'বগুড়া', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Pabna', banglaName: 'পাবনা', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Sirajganj', banglaName: 'সিরাজগঞ্জ', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Naogaon', banglaName: 'নওগাঁ', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Natore', banglaName: 'নাটোর', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Chapai Nawabganj', banglaName: 'চাঁপাইনবাবগঞ্জ', division: 'Rajshahi', defaultZone: 'outside_dhaka' },
  { name: 'Joypurhat', banglaName: 'জয়পুরহাট', division: 'Rajshahi', defaultZone: 'outside_dhaka' },

  // Khulna Division
  { name: 'Khulna', banglaName: 'খুলনা', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Jashore', banglaName: 'যশোর', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Kushtia', banglaName: 'কুষ্টিয়া', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Jhenaidah', banglaName: 'ঝিনাইদহ', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Satkhira', banglaName: 'সাতক্ষীরা', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Bagerhat', banglaName: 'বাগেরহাট', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Chuadanga', banglaName: 'চুয়াডাঙ্গা', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Magura', banglaName: 'মাগুরা', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Meherpur', banglaName: 'মেহেরপুর', division: 'Khulna', defaultZone: 'outside_dhaka' },
  { name: 'Narail', banglaName: 'নড়াইল', division: 'Khulna', defaultZone: 'outside_dhaka' },

  // Barishal Division
  { name: 'Barishal', banglaName: 'বরিশাল', division: 'Barishal', defaultZone: 'outside_dhaka' },
  { name: 'Bhola', banglaName: 'ভোলা', division: 'Barishal', defaultZone: 'outside_dhaka' },
  { name: 'Patuakhali', banglaName: 'পটুয়াখালী', division: 'Barishal', defaultZone: 'outside_dhaka' },
  { name: 'Pirojpur', banglaName: 'পিরোজপুর', division: 'Barishal', defaultZone: 'outside_dhaka' },
  { name: 'Jhalokati', banglaName: 'ঝালকাঠি', division: 'Barishal', defaultZone: 'outside_dhaka' },
  { name: 'Barguna', banglaName: 'বরগুনা', division: 'Barishal', defaultZone: 'outside_dhaka' },

  // Rangpur Division
  { name: 'Rangpur', banglaName: 'রংপুর', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Dinajpur', banglaName: 'দিনাজপুর', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Kurigram', banglaName: 'কুড়িগ্রাম', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Gaibandha', banglaName: 'গাইবান্ধা', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Nilphamari', banglaName: 'নীলফামারী', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Panchagarh', banglaName: 'পঞ্চগড়', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Thakurgaon', banglaName: 'ঠাকুরগাঁও', division: 'Rangpur', defaultZone: 'outside_dhaka' },
  { name: 'Lalmonirhat', banglaName: 'লালমনিরহাট', division: 'Rangpur', defaultZone: 'outside_dhaka' },

  // Mymensingh Division
  { name: 'Mymensingh', banglaName: 'ময়মনসিংহ', division: 'Mymensingh', defaultZone: 'outside_dhaka' },
  { name: 'Jamalpur', banglaName: 'জামালপুর', division: 'Mymensingh', defaultZone: 'outside_dhaka' },
  { name: 'Netrokona', banglaName: 'নেত্রকোণা', division: 'Mymensingh', defaultZone: 'outside_dhaka' },
  { name: 'Sherpur', banglaName: 'শেরপুর', division: 'Mymensingh', defaultZone: 'outside_dhaka' },
];

export const COURIER_PROVIDERS = [
  { id: 'Steadfast', name: 'Steadfast Courier', code: 'ST', defaultInsideCharge: 70, defaultOutsideCharge: 130 },
  { id: 'Pathao', name: 'Pathao Courier', code: 'PTH', defaultInsideCharge: 60, defaultOutsideCharge: 120 },
  { id: 'RedX', name: 'RedX Delivery', code: 'RDX', defaultInsideCharge: 65, defaultOutsideCharge: 130 },
  { id: 'eCourier', name: 'eCourier Ltd', code: 'ECR', defaultInsideCharge: 70, defaultOutsideCharge: 135 },
  { id: 'Paperfly', name: 'Paperfly', code: 'PFLY', defaultInsideCharge: 60, defaultOutsideCharge: 120 },
  { id: 'Sundarban', name: 'Sundarban Courier', code: 'SC', defaultInsideCharge: 80, defaultOutsideCharge: 150 },
  { id: 'SA Paribahan', name: 'SA Paribahan', code: 'SAP', defaultInsideCharge: 100, defaultOutsideCharge: 160 },
  { id: 'Manual', name: 'In-House / Showroom Pick', code: 'MAN', defaultInsideCharge: 0, defaultOutsideCharge: 0 },
];
