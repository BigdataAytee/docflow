import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Each entry is an array of field definitions for that currency.
// Keys map to Document entity fields:
//   bank_name, account_number, account_holder_name, reference_number (sort/BSB/routing/branch/clearing/bank-code), transaction_id (IBAN/SWIFT/CLABE/CBU)
// col-span-2 applied to account_holder_name and any full-width fields via `wide: true`

const FIELDS = {
  // Nigeria
  NGN: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. First Bank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 0123456789" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // United Kingdom
  GBP: [
    { key: "reference_number",    label: "Sort Code",         placeholder: "e.g. 20-00-00" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 12345678" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // United States
  USD: [
    { key: "reference_number",    label: "Routing Number (ABA)", placeholder: "9-digit routing number" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 000123456789" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Canada
  CAD: [
    { key: "bank_name",           label: "Institution Number",placeholder: "3-digit institution number" },
    { key: "reference_number",    label: "Transit Number",    placeholder: "5-digit transit number" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Australia
  AUD: [
    { key: "reference_number",    label: "BSB Number",        placeholder: "e.g. 062-000" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234 5678" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // New Zealand
  NZD: [
    { key: "account_number",      label: "Bank Account Number", placeholder: "e.g. 01-0102-0068389-00" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // South Africa
  ZAR: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Standard Bank" },
    { key: "reference_number",    label: "Branch Code",       placeholder: "e.g. 051001" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Kenya
  KES: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Equity Bank" },
    { key: "reference_number",    label: "Branch",            placeholder: "e.g. Nairobi Branch" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 0001234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Ghana
  GHS: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. GCB Bank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Uganda
  UGX: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Stanbic Bank" },
    { key: "reference_number",    label: "Branch",            placeholder: "e.g. Kampala Branch" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 9030005806282" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Tanzania
  TZS: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. CRDB Bank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 01J1000000000" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Rwanda
  RWF: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Bank of Kigali" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 000123456789" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // India
  INR: [
    { key: "reference_number",    label: "IFSC Code",         placeholder: "e.g. HDFC0001234" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 50100123456789" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Pakistan
  PKR: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. PK36SCBL0000001123456702", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Ahmed Khan", wide: true },
  ],
  // Bangladesh
  BDT: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Dutch-Bangla Bank" },
    { key: "reference_number",    label: "Branch",            placeholder: "e.g. Dhaka Main Branch" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1051234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Rahim Miah", wide: true },
  ],
  // Sri Lanka
  LKR: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Bank of Ceylon" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 0001234567" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Kasun Perera", wide: true },
  ],
  // Nepal
  NPR: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Nepal Bank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 0123456789012" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Ram Sharma", wide: true },
  ],
  // Singapore
  SGD: [
    { key: "bank_name",           label: "Bank Code",         placeholder: "e.g. 7171 (DBS)" },
    { key: "reference_number",    label: "Branch Code",       placeholder: "e.g. 001" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 123-456789-0" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Tan Ah Kow", wide: true },
  ],
  // Malaysia
  MYR: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Maybank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234 5678 9012" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Ahmad Bin Ali", wide: true },
  ],
  // Indonesia
  IDR: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. BCA" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Budi Santoso", wide: true },
  ],
  // Philippines
  PHP: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. BDO" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Juan dela Cruz", wide: true },
  ],
  // Thailand
  THB: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Bangkok Bank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 123-4-56789-0" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Somchai K.", wide: true },
  ],
  // Vietnam
  VND: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Vietcombank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 0123456789" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Nguyen Van A", wide: true },
  ],
  // China
  CNY: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. ICBC" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 6222021234567890123" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Zhang Wei", wide: true },
  ],
  // Hong Kong
  HKD: [
    { key: "bank_name",           label: "Bank Code",         placeholder: "e.g. 004 (HSBC)" },
    { key: "reference_number",    label: "Branch Code",       placeholder: "e.g. 001" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 123-456789-001" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Chan Tai Man", wide: true },
  ],
  // Japan
  JPY: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Mitsubishi UFJ" },
    { key: "reference_number",    label: "Branch Code",       placeholder: "e.g. 001" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Yamada Taro", wide: true },
  ],
  // South Korea
  KRW: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Kookmin Bank" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 123-01-123456" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Kim Minsu", wide: true },
  ],
  // UAE
  AED: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. AE070331234567890123456", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Saudi Arabia
  SAR: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. SA0380000000608010167519", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Qatar
  QAR: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. QA58DOHB00001234567890ABCDEFG", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Bahrain
  BHD: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. BH67BMAG00001299123456", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Kuwait
  KWD: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. KW81CBKU0000000000001234560101", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Oman
  OMR: [
    { key: "transaction_id",      label: "IBAN / Account Number", placeholder: "e.g. OM810180000070000012345", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Turkey
  TRY: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. TR330006100519786457841326", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Ahmet Yılmaz", wide: true },
  ],
  // Euro (EU / most European countries)
  EUR: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. DE89370400440532013000", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. John Doe", wide: true },
  ],
  // Switzerland
  CHF: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. CH9300762011623852957", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Hans Müller", wide: true },
  ],
  // Norway
  NOK: [
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234.56.78901" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Ole Hansen", wide: true },
  ],
  // Sweden
  SEK: [
    { key: "reference_number",    label: "Clearing Number",   placeholder: "e.g. 3300" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Lars Eriksson", wide: true },
  ],
  // Denmark
  DKK: [
    { key: "reference_number",    label: "Registration Number", placeholder: "e.g. 1234" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Lars Nielsen", wide: true },
  ],
  // Poland
  PLN: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. PL61109010140000071219812874", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Jan Kowalski", wide: true },
  ],
  // Czech Republic
  CZK: [
    { key: "reference_number",    label: "Bank Code",         placeholder: "e.g. 0800" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 19-2000145399" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Jan Novák", wide: true },
  ],
  // Brazil
  BRL: [
    { key: "bank_name",           label: "Bank Code",         placeholder: "e.g. 001 (Banco do Brasil)" },
    { key: "reference_number",    label: "Branch Number (Agência)", placeholder: "e.g. 0001" },
    { key: "account_number",      label: "Account Number (Conta)", placeholder: "e.g. 12345-6" },
    { key: "transaction_id",      label: "CPF / CNPJ",        placeholder: "e.g. 123.456.789-09", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. João Silva", wide: true },
  ],
  // Mexico
  MXN: [
    { key: "transaction_id",      label: "CLABE",             placeholder: "18-digit CLABE number", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Juan García", wide: true },
  ],
  // Argentina
  ARS: [
    { key: "transaction_id",      label: "CBU / CVU",         placeholder: "22-digit CBU or CVU", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Juan Pérez", wide: true },
  ],
  // Chile
  CLP: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Banco de Chile" },
    { key: "reference_number",    label: "RUT",               placeholder: "e.g. 12.345.678-9" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 12345678" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Carlos Soto", wide: true },
  ],
  // Colombia
  COP: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Bancolombia" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 12345678901" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Carlos Rodríguez", wide: true },
  ],
  // Peru
  PEN: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. BCP" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 1234567890123" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Luis García", wide: true },
  ],
  // Israel
  ILS: [
    { key: "bank_name",           label: "Bank Name",         placeholder: "e.g. Bank Hapoalim" },
    { key: "reference_number",    label: "Branch Number",     placeholder: "e.g. 690" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 123456" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. David Cohen", wide: true },
  ],
  // Russia
  RUB: [
    { key: "reference_number",    label: "BIK (Bank ID)",     placeholder: "e.g. 044525225" },
    { key: "account_number",      label: "Account Number",    placeholder: "e.g. 40817810099910004312" },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Ivan Petrov", wide: true },
  ],
  // Egypt
  EGP: [
    { key: "transaction_id",      label: "IBAN",              placeholder: "e.g. EG380019000500000000263180002", wide: true },
    { key: "account_holder_name", label: "Account Name",      placeholder: "e.g. Mohamed Ali", wide: true },
  ],
};

// Default for unmapped currencies
const DEFAULT_FIELDS = [
  { key: "bank_name",           label: "Bank Name",              placeholder: "Enter bank name" },
  { key: "account_number",      label: "Account Number / IBAN",  placeholder: "Enter account number or IBAN" },
  { key: "account_holder_name", label: "Account Name",           placeholder: "Enter account holder name", wide: true },
];

export default function BankDetailsFields({ currency, form, setForm }) {
  const fields = FIELDS[currency] || DEFAULT_FIELDS;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map(field => (
        <div key={field.key} className={field.wide ? "sm:col-span-2" : ""}>
          <Label>{field.label}</Label>
          <Input
            className="mt-1"
            value={form[field.key] || ""}
            onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
          />
        </div>
      ))}
    </div>
  );
}