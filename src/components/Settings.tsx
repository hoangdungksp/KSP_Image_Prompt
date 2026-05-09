import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { getSettings, saveSettings, testApiKey, type KSPSettings } from "../engine/gemini";
import { testOpenAIKey } from "../engine/openai";

export function Settings() {
  const { showToast } = useAppStore();
  const [settings, setSettings] = useState<KSPSettings>({});
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  // v0.6.5: OpenAI key state
  const [openaiKey, setOpenaiKey] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setApiKey(s.geminiApiKey || "");
      setOpenaiKey(s.openaiApiKey || "");
    });
  }, []);

  const handleSave = async () => {
    const newSettings: KSPSettings = {
      ...settings,
      geminiApiKey: apiKey.trim(),
      openaiApiKey: openaiKey.trim(),
    };
    await saveSettings(newSettings);
    setSettings(newSettings);
    showToast("Đã lưu settings", "success");
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      showToast("Nhập API key trước", "error");
      return;
    }
    setTesting(true);
    const ok = await testApiKey(apiKey.trim());
    setTesting(false);
    showToast(ok ? "✅ Gemini API key OK" : "❌ Gemini API key invalid", ok ? "success" : "error");
  };

  // v0.6.5: Test OpenAI key
  const handleTestOpenai = async () => {
    if (!openaiKey.trim()) {
      showToast("Nhập OpenAI API key trước", "error");
      return;
    }
    setTestingOpenai(true);
    const ok = await testOpenAIKey(openaiKey.trim());
    setTestingOpenai(false);
    showToast(ok ? "✅ OpenAI API key OK" : "❌ OpenAI API key invalid", ok ? "success" : "error");
  };

  return (
    <div className="p-3 space-y-3">
      <div className="bg-ksp-panel border border-ksp-border rounded-lg p-3 space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-1">🔑 Gemini API Key</h3>
          <p className="text-xs text-ksp-muted leading-relaxed">
            Dùng để dịch tự động ý tưởng tiếng Việt sang tiếng Anh cho Banana Pro. Lấy free API key tại{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-ksp-accent underline"
            >
              aistudio.google.com
            </a>
            . Key được lưu local trong trình duyệt, không gửi đi đâu.
          </p>
        </div>

        <div>
          <label>API Key</label>
          <div className="flex gap-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="font-mono text-xs"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-2 py-1 bg-ksp-bg border border-ksp-border rounded text-xs"
              title={showKey ? "Ẩn" : "Hiện"}
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !apiKey.trim()}
            className="flex-1 px-3 py-2 bg-ksp-bg border border-ksp-border rounded text-xs hover:border-ksp-accent disabled:opacity-30"
          >
            {testing ? "Đang test..." : "🧪 Test Key"}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-2 bg-ksp-accent text-black rounded text-xs font-semibold"
          >
            💾 Save
          </button>
        </div>

        {settings.geminiApiKey && (
          <div className="text-[10px] text-ksp-good">
            ✓ Đã có Gemini key — Auto-translate + Storyboard AI hoạt động
          </div>
        )}
      </div>

      {/* v0.6.5: OpenAI API Key (alternative to Gemini) */}
      <div className="bg-ksp-panel border border-ksp-border rounded-lg p-3 space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-1">🧠 OpenAI API Key (optional)</h3>
          <p className="text-xs text-ksp-muted leading-relaxed">
            Dùng GPT-4o-mini làm AI alternative cho Storyboard generation. So sánh với Gemini xem cái nào chất lượng tốt hơn cho TVC. Lấy API key tại{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-ksp-accent underline"
            >
              platform.openai.com/api-keys
            </a>
            .
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[11px]">OpenAI API Key</label>
          <div className="flex gap-1">
            <input
              type={showOpenaiKey ? "text" : "password"}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="text-xs flex-1 font-mono"
            />
            <button
              onClick={() => setShowOpenaiKey(!showOpenaiKey)}
              className="px-2 text-xs bg-ksp-bg border border-ksp-border rounded hover:border-ksp-accent"
            >
              {showOpenaiKey ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleTestOpenai}
            disabled={testingOpenai || !openaiKey.trim()}
            className="flex-1 px-3 py-2 bg-ksp-bg border border-ksp-border rounded text-xs hover:border-ksp-accent disabled:opacity-30"
          >
            {testingOpenai ? "Đang test..." : "🧪 Test OpenAI Key"}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-2 bg-ksp-accent text-black rounded text-xs font-semibold"
          >
            💾 Save
          </button>
        </div>

        {settings.openaiApiKey && (
          <div className="text-[10px] text-ksp-good">
            ✓ Đã có OpenAI key — Storyboard AI có thể chọn ChatGPT
          </div>
        )}

        <p className="text-[10px] text-ksp-muted leading-relaxed">
          💡 <strong>So sánh:</strong> Gemini Flash (free, nhanh) vs ChatGPT GPT-4o-mini (~$0.15/1M tokens, chất lượng cao hơn cho creative writing). Có cả 2 keys → khi tạo storyboard có thể switch giữa 2 providers để compare.
        </p>
      </div>

      {/* v0.6.2: Boost Face Fidelity guide */}
      <div className="bg-ksp-panel border border-ksp-border rounded-lg p-3 space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-1">🎯 Boost Face Fidelity ({'>'}95% giống)</h3>
          <p className="text-xs text-ksp-muted leading-relaxed">
            KSP Image generate prompt → Banana Pro thường đạt 70-90% giống mặt. Để đạt {'>'}95%, dùng tools chuyên về face cloning bên ngoài:
          </p>
        </div>

        {/* Higgsfield Soul ID - PRIMARY recommend */}
        <div className="bg-purple-500/5 border border-purple-500/30 rounded p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-purple-400">⭐ Higgsfield Soul ID (Recommend)</h4>
            <a
              href="https://higgsfield.ai/soul-id"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30"
            >
              Mở Higgsfield ↗
            </a>
          </div>
          <p className="text-[11px] text-ksp-text/80 leading-relaxed">
            Web-based, easy nhất. Train character ID 1 lần → generate vô hạn ảnh giống ~90-95%. Free 50 generations đầu.
          </p>
          <div className="text-[10px] text-ksp-muted leading-relaxed space-y-0.5">
            <div><strong>Workflow:</strong></div>
            <div>1. Tạo prompt trong KSP Image như bình thường</div>
            <div>2. Copy prompt</div>
            <div>3. Mở higgsfield.ai → Soul ID</div>
            <div>4. Upload 5-10 ảnh face Jason (đa góc)</div>
            <div>5. Train character (~5 phút)</div>
            <div>6. Paste prompt KSP Image vào → generate</div>
            <div>7. Download ảnh ~95% giống</div>
          </div>
          <p className="text-[10px] text-purple-400 italic">
            Tip: 1 character đã train có thể dùng cho nhiều prompts khác nhau.
          </p>
        </div>

        {/* Replicate PuLID - PROGRAMMATIC */}
        <details className="bg-blue-500/5 border border-blue-500/30 rounded p-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-blue-400">
            🔧 Replicate PuLID (Programmatic, ~$1-2 / 100 ảnh)
          </summary>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-ksp-text/80 leading-relaxed">
              API-based, cần Replicate account ($5 credit free). Best cho batch generation số lượng lớn.
            </p>
            <div className="text-[10px] text-ksp-muted leading-relaxed space-y-0.5">
              <div>1. Đăng ký <a href="https://replicate.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">replicate.com</a></div>
              <div>2. Get API token</div>
              <div>3. Dùng model <code className="bg-ksp-bg px-1 rounded">zsxkib/pulid</code> hoặc <code className="bg-ksp-bg px-1 rounded">cubiq/pulid</code></div>
              <div>4. Input: prompt + face image → Output: ảnh ~85-90% giống</div>
            </div>
            <a
              href="https://replicate.com/zsxkib/pulid"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-blue-400 underline"
            >
              Replicate PuLID model ↗
            </a>
          </div>
        </details>

        {/* Roop Face Swap - FREE LOCAL */}
        <details className="bg-green-500/5 border border-green-500/30 rounded p-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-green-400">
            💾 Roop Unleashed (Free, chạy local, cần GPU)
          </summary>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-ksp-text/80 leading-relaxed">
              Hybrid workflow: generate ảnh bằng Banana Pro thường (70-80% giống) → face swap bằng Roop → đạt 95-98%.
            </p>
            <div className="text-[10px] text-ksp-muted leading-relaxed space-y-0.5">
              <div>1. Cài <a href="https://github.com/C0untFloyd/roop-unleashed" target="_blank" rel="noreferrer" className="text-green-400 underline">Roop Unleashed</a> (Windows/Mac)</div>
              <div>2. Generate ảnh từ Banana Pro (KSP Image prompt)</div>
              <div>3. Open Roop → upload face source + ảnh đã generate</div>
              <div>4. Face swap → output 95-98% giống</div>
            </div>
            <p className="text-[10px] text-green-400 italic">
              ⚠️ Cần NVIDIA GPU (8GB+ VRAM) hoặc Mac M-series cho speed.
            </p>
          </div>
        </details>

        {/* LoRA training - FUTURE */}
        <details className="bg-yellow-500/5 border border-yellow-500/30 rounded p-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-yellow-400">
            🚀 Train LoRA (Future option, ~$5-10 once)
          </summary>
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-ksp-text/80 leading-relaxed">
              One-time investment, lifetime use. Train LoRA cho 1 face → mọi prompt sau đó đều ra mặt giống ~95%.
            </p>
            <div className="text-[10px] text-ksp-muted leading-relaxed space-y-0.5">
              <div>1. Collect 15-30 ảnh subject (đa góc, lighting)</div>
              <div>2. Dùng <a href="https://replicate.com/ostris/flux-dev-lora-trainer" target="_blank" rel="noreferrer" className="text-yellow-400 underline">Replicate FLUX LoRA trainer</a></div>
              <div>3. Train ~1-2h ($5-10)</div>
              <div>4. Apply LoRA + KSP Image prompt → 95%+ giống mọi lần</div>
            </div>
          </div>
        </details>
      </div>

      <div className="bg-ksp-panel border border-ksp-border rounded-lg p-3">
        <h3 className="text-sm font-semibold mb-2">ℹ️ Về KSP Image</h3>
        <p className="text-xs text-ksp-muted leading-relaxed">
          v0.8.1 — Generate prompt siêu thật cho Banana Pro / Nano Banana từ ý tưởng + reference images.
          Bao gồm TVC Storyboard generator, Animation prompts, Face fidelity guide.
        </p>
      </div>
    </div>
  );
}
