export type GpuClass = "physical" | "software" | "unknown";

export type GpuSource = "webgpu-device-adapter-info" | "webgpu-request-adapter-reporting-only" | "webgl-debug-renderer-info" | "webgl-masked-renderer" | "unavailable";

export type GpuCapability = Readonly<{
  backend: "WebGPU" | "WebGL2";
  forceWebGL: boolean;
  gpuClass: GpuClass;
  label: string;
  detail: string;
  source: GpuSource;
}>;

const SOFTWARE_PATTERN = /swiftshader|llvmpipe|lavapipe|software|basic render/i;
const MASKED_RENDERERS: ReadonlySet<string> = new Set(["", "webkit webgl", "webgl", "mozilla"]);

type AdapterInfo = Readonly<{
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  isFallbackAdapter: boolean | undefined;
}>;

const isObject = (value: unknown): value is object => (typeof value === "object" && value !== null) || typeof value === "function";

function field(value: unknown, key: string): unknown {
  return isObject(value) ? Reflect.get(value, key) : undefined;
}

const textField = (value: unknown, key: string): string => {
  const found = field(value, key);
  return typeof found === "string" ? found.trim() : "";
};

function adapterInfoFrom(value: unknown): AdapterInfo | undefined {
  if (!isObject(value)) return undefined;
  const fallback = field(value, "isFallbackAdapter");
  return {
    vendor: textField(value, "vendor"),
    architecture: textField(value, "architecture"),
    device: textField(value, "device"),
    description: textField(value, "description"),
    isFallbackAdapter: typeof fallback === "boolean" ? fallback : undefined,
  };
}

function classifyAdapter(info: AdapterInfo): GpuClass {
  if (info.isFallbackAdapter === true) return "software";
  if (SOFTWARE_PATTERN.test(`${info.vendor} ${info.architecture} ${info.device} ${info.description}`)) return "software";
  const identified = [info.vendor, info.architecture, info.device, info.description].some((part) => part !== "");
  return identified ? "physical" : "unknown";
}

function classifyRendererString(renderer: string): GpuClass {
  if (SOFTWARE_PATTERN.test(renderer)) return "software";
  return MASKED_RENDERERS.has(renderer.toLowerCase()) ? "unknown" : "physical";
}

const identifies = (info: AdapterInfo): boolean =>
  info.isFallbackAdapter === true || [info.vendor, info.architecture, info.device, info.description].some((part) => part !== "");

function describeAdapter(info: AdapterInfo): Readonly<{ label: string; detail: string }> {
  const label = info.description || info.device || [info.vendor, info.architecture].filter((part) => part !== "").join(" ") || "unidentified adapter";
  const detail = `vendor=${info.vendor || "-"} architecture=${info.architecture || "-"} device=${info.device || "-"} description=${info.description || "-"} isFallbackAdapter=${String(info.isFallbackAdapter ?? "unreported")}`;
  return { label, detail };
}

async function requestedAdapterInfo(): Promise<AdapterInfo | undefined> {
  const gpu: unknown = Reflect.get(navigator, "gpu");
  const request = field(gpu, "requestAdapter");
  if (typeof request !== "function") return undefined;
  const pending: unknown = Reflect.apply(request, gpu, []);
  const adapter: unknown = await pending;
  return adapterInfoFrom(field(adapter, "info"));
}

async function webGpuCapability(backend: unknown, forceWebGL: boolean): Promise<GpuCapability> {
  const used = adapterInfoFrom(field(field(backend, "device"), "adapterInfo"));
  const reported = await requestedAdapterInfo();
  const reportedText = reported === undefined ? "not available" : describeAdapter(reported).detail;
  const base = { backend: "WebGPU", forceWebGL } as const;
  if (used !== undefined && identifies(used)) {
    const { label, detail } = describeAdapter(used);
    return { ...base, gpuClass: classifyAdapter(used), label, detail: `${detail}; requestAdapter() reporting only: ${reportedText}`, source: "webgpu-device-adapter-info" };
  }
  if (reported !== undefined && identifies(reported)) {
    const { label } = describeAdapter(reported);
    return {
      ...base,
      gpuClass: classifyAdapter(reported) === "software" ? "software" : "unknown",
      label: `${label} (requestAdapter, reporting only)`,
      detail: `renderer device reported no adapter info; requestAdapter() reporting only: ${reportedText}`,
      source: "webgpu-request-adapter-reporting-only",
    };
  }
  return { ...base, gpuClass: "unknown", label: "unidentified adapter", detail: `no adapter info from the renderer device; requestAdapter(): ${reportedText}`, source: "unavailable" };
}

function webGlCapability(backend: unknown, forceWebGL: boolean): GpuCapability {
  const gl = field(backend, "gl");
  if (!(gl instanceof WebGL2RenderingContext)) {
    return { backend: "WebGL2", forceWebGL, gpuClass: "unknown", label: "unavailable", detail: "no WebGL2 context on the renderer backend", source: "unavailable" };
  }
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(debug === null ? gl.getParameter(gl.RENDERER) : gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
  const vendor = String(debug === null ? gl.getParameter(gl.VENDOR) : gl.getParameter(debug.UNMASKED_VENDOR_WEBGL));
  return {
    backend: "WebGL2",
    forceWebGL,
    gpuClass: debug === null ? "unknown" : classifyRendererString(renderer),
    label: renderer,
    detail: `renderer=${renderer} vendor=${vendor} unmasked=${String(debug !== null)}`,
    source: debug === null ? "webgl-masked-renderer" : "webgl-debug-renderer-info",
  };
}

export function readGpuCapability(backend: unknown, backendName: GpuCapability["backend"], forceWebGL: boolean): Promise<GpuCapability> {
  return backendName === "WebGPU" ? webGpuCapability(backend, forceWebGL) : Promise.resolve(webGlCapability(backend, forceWebGL));
}
