import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, Search, MapPin, RefreshCw, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';

interface DistrictStat { district: string; state: string | null; pipeline_name: string | null; pincode_count: string; }
interface Stats { districts: DistrictStat[]; total: number; }
interface PreviewRow { pincode: string; district: string; state: string; pipeline_name: string; }

export default function PincodeRoutingPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<Stats>({ districts: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState('');
  const [testPin, setTestPin] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const loadStats = async () => {
    try {
      const s = await api.get<Stats>('/api/pincode-routing/stats');
      setStats(s ?? { districts: [], total: 0 });
    } catch { setStats({ districts: [], total: 0 }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStats(); }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (raw.length === 0) { toast.error('File is empty or unreadable'); return; }

        // Auto-detect column names (case-insensitive)
        const sample = raw[0];
        const keys = Object.keys(sample).map((k) => k.toLowerCase().trim());
        const findKey = (candidates: string[]) =>
          Object.keys(sample).find((k) => candidates.includes(k.toLowerCase().trim())) ?? '';

        const pincodeKey   = findKey(['pincode', 'pin code', 'pin', 'postal_code', 'postalcode', 'zip', 'zipcode']);
        const districtKey  = findKey(['district', 'city', 'town', 'area', 'location']);
        const stateKey     = findKey(['state', 'province', 'region']);
        const pipelineKey  = findKey(['pipeline', 'pipeline_name', 'pipeline name']);

        if (!pincodeKey || !districtKey) {
          toast.error(`Columns not found. Need "pincode" and "district" columns. Found: ${keys.join(', ')}`);
          return;
        }

        const rows: PreviewRow[] = raw.map((r) => ({
          pincode:       String(r[pincodeKey] ?? '').trim(),
          district:      String(r[districtKey] ?? '').trim(),
          state:         stateKey ? String(r[stateKey] ?? '').trim() : '',
          pipeline_name: pipelineKey ? String(r[pipelineKey] ?? '').trim() : '',
        })).filter((r) => r.pincode && r.district);

        if (rows.length === 0) { toast.error('No valid rows found after filtering blank pincodes/districts'); return; }
        setPreview(rows);
        toast.success(`Found ${rows.length} rows ready to upload`);
      } catch {
        toast.error('Failed to read file. Ensure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (preview.length === 0) return;
    setUploading(true);
    try {
      const res = await api.post<any>('/api/pincode-routing/upload', { rows: preview });
      toast.success(`Uploaded ${res.inserted} pincodes (${res.skipped} skipped)`);
      setPreview([]);
      await loadStats();
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally { setUploading(false); }
  };

  const handleClear = async () => {
    if (!confirm('Delete all pincode mappings? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res = await api.delete<any>('/api/pincode-routing');
      toast.success(`Cleared ${res.deleted} mappings`);
      await loadStats();
    } catch { toast.error('Failed to clear mappings'); }
    finally { setClearing(false); }
  };

  const handleTest = async () => {
    if (!testPin.trim()) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await api.get<any>(`/api/pincode-routing/lookup/${testPin.trim()}`);
      setTestResult({ found: true, ...res });
    } catch {
      setTestResult({ found: false });
    } finally { setTesting(false); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['pincode', 'district', 'state', 'pipeline_name'],
      ['641001', 'Coimbatore', 'Tamil Nadu', 'CB9 Pipeline'],
      ['641003', 'Coimbatore', 'Tamil Nadu', 'CB9 Pipeline'],
      ['600001', 'Chennai', 'Tamil Nadu', 'Chennai Pipeline'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pincodes');
    XLSX.writeFile(wb, 'pincode_template.xlsx');
  };

  const filteredDistricts = stats.districts.filter((d) =>
    d.district.toLowerCase().includes(search.toLowerCase()) ||
    (d.pipeline_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl hover:bg-black/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#7a6b5c]" />
        </button>
        <div>
          <h1 className="text-2xl font-headline font-bold text-[#1c1410]">Pincode Routing</h1>
          <p className="text-[13px] text-[#7a6b5c]">Map pincodes to districts and pipelines for automatic lead routing</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Pincodes', value: loading ? '…' : stats.total.toLocaleString() },
          { label: 'Districts', value: loading ? '…' : stats.districts.length.toString() },
          { label: 'Pipelines Mapped', value: loading ? '…' : stats.districts.filter((d) => d.pipeline_name).length.toString() },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-black/5 p-5">
            <p className="text-[12px] text-[#7a6b5c] font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-3xl font-bold text-[#1c1410] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Upload section */}
      <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[#1c1410]">Upload Pincode Excel</h2>
            <p className="text-[12px] text-[#7a6b5c] mt-0.5">Upload an Excel (.xlsx) or CSV file with pincode, district, state, pipeline_name columns</p>
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-[12px] text-primary font-semibold hover:underline">
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#e8ddd4] rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-[#faf5f0] transition-colors"
        >
          <MapPin className="w-8 h-8 text-[#c4b09e] mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-[#1c1410]">Click to select your Excel / CSV file</p>
          <p className="text-[11px] text-[#7a6b5c] mt-1">Columns needed: <span className="font-mono bg-gray-100 px-1 rounded">pincode</span> and <span className="font-mono bg-gray-100 px-1 rounded">district</span> (state and pipeline_name optional)</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />

        {/* Preview */}
        {preview.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#1c1410]">{preview.length} rows ready to upload</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreview([])}>Cancel</Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading}
                  style={{ background: 'linear-gradient(135deg,#c2410c,#ea580c)' }}>
                  {uploading ? 'Uploading…' : `Upload ${preview.length} rows`}
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-black/5 max-h-64 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#faf8f6] sticky top-0">
                  <tr>{['Pincode', 'District', 'State', 'Pipeline'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#7a6b5c]">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {preview.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-[#faf8f6]">
                      <td className="px-3 py-1.5 font-mono text-[#1c1410]">{r.pincode}</td>
                      <td className="px-3 py-1.5 text-[#1c1410]">{r.district}</td>
                      <td className="px-3 py-1.5 text-[#7a6b5c]">{r.state || '—'}</td>
                      <td className="px-3 py-1.5 text-[#7a6b5c]">{r.pipeline_name || '—'}</td>
                    </tr>
                  ))}
                  {preview.length > 50 && (
                    <tr><td colSpan={4} className="px-3 py-2 text-center text-[11px] text-[#7a6b5c]">…and {preview.length - 50} more rows</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Test lookup */}
      <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-3">
        <h2 className="font-bold text-[#1c1410]">Test a Pincode</h2>
        <div className="flex gap-2">
          <input
            value={testPin} onChange={(e) => setTestPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            placeholder="Enter pincode to test (e.g. 641001)"
            className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-[13px] outline-none focus:border-primary/40"
          />
          <Button onClick={handleTest} disabled={testing || !testPin.trim()}>
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        {testResult && (
          <div className={`flex items-start gap-2 p-3 rounded-xl text-[13px] ${testResult.found ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {testResult.found
              ? <><CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /><span className="text-green-800">Found: <strong>{testResult.district}</strong>{testResult.state ? `, ${testResult.state}` : ''}{testResult.pipeline_name ? ` → Pipeline: ${testResult.pipeline_name}` : ''}</span></>
              : <><AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span className="text-red-700">Pincode not found in mapping table</span></>
            }
          </div>
        )}
      </div>

      {/* District table */}
      {stats.total > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#1c1410]">Configured Districts ({stats.districts.length})</h2>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#b09e8d]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search district…" className="pl-8 pr-3 py-2 text-[12px] border border-black/10 rounded-xl outline-none focus:border-primary/40 w-44" />
              </div>
              <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing}
                className="text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                {clearing ? 'Clearing…' : 'Clear All'}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-black/5 max-h-96 overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#faf8f6] sticky top-0">
                <tr>{['District', 'State', 'Pipeline', 'Pincodes'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#7a6b5c]">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredDistricts.map((d, i) => (
                  <tr key={i} className="hover:bg-[#faf8f6]">
                    <td className="px-4 py-2.5 font-semibold text-[#1c1410]">{d.district}</td>
                    <td className="px-4 py-2.5 text-[#7a6b5c]">{d.state || '—'}</td>
                    <td className="px-4 py-2.5">
                      {d.pipeline_name
                        ? <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-[11px] font-semibold rounded-full border border-orange-100">{d.pipeline_name}</span>
                        : <span className="text-[#b09e8d] text-[12px]">Not mapped</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[#7a6b5c] font-mono text-[12px]">{d.pincode_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
