const BASE = "https://lms.unindra.ac.id";

const res = await fetch(`${BASE}/`, { redirect: "manual" });
console.log("status:", res.status);

const cookies = res.headers.getSetCookie?.() ?? [];
console.log("nama cookie:", cookies.map((c) => c.split("=")[0]));

const html = await res.text();

console.log("--- form ---");
for (const m of html.matchAll(/<form\b[^>]*>/gi)) console.log(m[0]);

console.log("--- input (nama dan tipe saja) ---");
for (const m of html.matchAll(/<input\b[^>]*>/gi)) {
  const name = m[0].match(/name=["']([^"']+)["']/i)?.[1];
  const type = m[0].match(/type=["']([^"']+)["']/i)?.[1];
  console.log({ name, type });
}