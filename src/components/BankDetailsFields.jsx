import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Maps currency to the bank detail fields required in that country
const BANK_FIELDS_BY_CURRENCY = {
  // UK / Crown Dependencies
  GBP: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Barclays" },
    { key: "account_number",     label: "Account Number",    placeholder: "8-digit account number" },
    { key: "reference_number",   label: "Sort Code",         placeholder: "e.g. 20-00-00" },
    { key: "account_holder_name",label: "Account Name",      placeholder: "e.g. John Doe" },
  ],
  // Nigeria
  NGN: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. First Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 0123456789" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // USA
  USD: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Chase" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 000123456789" },
    { key: "reference_number",   label: "Routing Number (ABA)", placeholder: "9-digit routing number" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // EU / SEPA countries
  EUR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Deutsche Bank" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. DE89370400440532013000" },
    { key: "transaction_id",     label: "BIC / SWIFT",       placeholder: "e.g. DEUTDEDB" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // Canada
  CAD: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. RBC" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234567" },
    { key: "reference_number",   label: "Transit + Institution Number", placeholder: "e.g. 00012-003" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // Australia
  AUD: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Commonwealth Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234 5678" },
    { key: "reference_number",   label: "BSB Number",        placeholder: "e.g. 062-000" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // New Zealand
  NZD: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. ANZ" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 01-0102-0068389-00" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // South Africa
  ZAR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Standard Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "reference_number",   label: "Branch Code",       placeholder: "e.g. 051001" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // Ghana
  GHS: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. GCB Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // Kenya
  KES: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Equity Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 0001234567890" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // India
  INR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. HDFC Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 50100123456789" },
    { key: "reference_number",   label: "IFSC Code",         placeholder: "e.g. HDFC0001234" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // UAE
  AED: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Emirates NBD" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. AE070331234567890123456" },
    { key: "transaction_id",     label: "BIC / SWIFT",       placeholder: "e.g. EBILAEAD" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // Saudi Arabia
  SAR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Al Rajhi Bank" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. SA0380000000608010167519" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. John Doe" },
  ],
  // China
  CNY: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. ICBC" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 6222021234567890123" },
    { key: "transaction_id",     label: "SWIFT Code",        placeholder: "e.g. ICBKCNBJ" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Zhang Wei" },
  ],
  // Japan
  JPY: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Mitsubishi UFJ" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234567" },
    { key: "reference_number",   label: "Branch Code",       placeholder: "e.g. 001" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Yamada Taro" },
  ],
  // Brazil
  BRL: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Banco do Brasil" },
    { key: "account_number",     label: "Account Number (Conta)", placeholder: "e.g. 12345-6" },
    { key: "reference_number",   label: "Agency (Agência)",  placeholder: "e.g. 0001" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. João Silva" },
  ],
  // Mexico
  MXN: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. BBVA" },
    { key: "account_number",     label: "CLABE",             placeholder: "18-digit CLABE number" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Juan García" },
  ],
  // Switzerland
  CHF: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. UBS" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. CH9300762011623852957" },
    { key: "transaction_id",     label: "BIC / SWIFT",       placeholder: "e.g. UBSWCHZH80A" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Hans Müller" },
  ],
  // Singapore
  SGD: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. DBS" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 123-456789-0" },
    { key: "transaction_id",     label: "SWIFT Code",        placeholder: "e.g. DBSSSGSG" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Tan Ah Kow" },
  ],
  // South Korea
  KRW: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Kookmin Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 123-01-123456" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Kim Minsu" },
  ],
  // Turkey
  TRY: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Garanti BBVA" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. TR330006100519786457841326" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Ahmet Yılmaz" },
  ],
  // Israel
  ILS: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Bank Hapoalim" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 123456" },
    { key: "reference_number",   label: "Branch Number",     placeholder: "e.g. 690" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. David Cohen" },
  ],
  // Pakistan
  PKR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. HBL" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. PK36SCBL0000001123456702" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Ahmed Khan" },
  ],
  // Bangladesh
  BDT: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Dutch-Bangla Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1051234567890" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Rahim Miah" },
  ],
  // Egypt
  EGP: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. CIB" },
    { key: "account_number",     label: "IBAN",              placeholder: "e.g. EG380019000500000000263180002" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Mohamed Ali" },
  ],
  // Argentina
  ARS: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Banco Nación" },
    { key: "account_number",     label: "CBU",               placeholder: "22-digit CBU" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Juan Pérez" },
  ],
  // Colombia
  COP: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Bancolombia" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 12345678901" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Carlos Rodríguez" },
  ],
  // Malaysia
  MYR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Maybank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234 5678 9012" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Ahmad Bin Ali" },
  ],
  // Indonesia
  IDR: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. BCA" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Budi Santoso" },
  ],
  // Philippines
  PHP: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. BDO" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 1234567890" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Juan dela Cruz" },
  ],
  // Thailand
  THB: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Bangkok Bank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 123-4-56789-0" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Somchai K." },
  ],
  // Russia
  RUB: [
    { key: "bank_name",          label: "Bank Name",         placeholder: "e.g. Sberbank" },
    { key: "account_number",     label: "Account Number",    placeholder: "e.g. 40817810099910004312" },
    { key: "reference_number",   label: "BIK (Bank ID)",     placeholder: "e.g. 044525225" },
    { key: "account_holder_name",label: "Account Holder Name",placeholder: "e.g. Ivan Petrov" },
  ],
};

// Default fields for currencies not specifically mapped
const DEFAULT_FIELDS = [
  { key: "bank_name",          label: "Bank Name",         placeholder: "Enter bank name" },
  { key: "account_number",     label: "Account Number / IBAN", placeholder: "Enter account number or IBAN" },
  { key: "transaction_id",     label: "SWIFT / BIC Code",  placeholder: "e.g. AAAABBCC123" },
  { key: "account_holder_name",label: "Account Holder Name",placeholder: "Enter account holder name" },
];

export default function BankDetailsFields({ currency, form, setForm }) {
  const fields = BANK_FIELDS_BY_CURRENCY[currency] || DEFAULT_FIELDS;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map(field => (
        <div key={field.key} className={field.key === "account_holder_name" ? "col-span-2" : ""}>
          <Label>{field.label}</Label>
          <Input
            value={form[field.key] || ""}
            onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
          />
        </div>
      ))}
    </div>
  );
}