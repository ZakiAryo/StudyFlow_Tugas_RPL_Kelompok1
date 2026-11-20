import * as cheerio from "cheerio";
import type {
  LMSContent,
  LMSContentsResponse,
  LMSDashboardCourse,
  LMSDashboardResponse,
  LMSMeeting,
  LMSMeetingsResponse,
} from "./types";

const LMS_BASE = "https://lms.unindra.ac.id";

function toAbsoluteUrl(urlOrPath: string): string {
  if (!urlOrPath) return "";
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    return urlOrPath;
  }
  const cleanPath = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  return `${LMS_BASE}${cleanPath}`;
}

function isSessionExpiredHtml(html: string): boolean {
  return (
    html.includes('name="pswd"') ||
    html.includes('name="kapca"') ||
    html.includes("/login_new") ||
    /<title>\s*Login\b/i.test(html)
  );
}

/**
 * Mem-parse HTML halaman /member menjadi LMSDashboardResponse
 */
export function parseDashboardHTML(html: string): LMSDashboardResponse {
  if (isSessionExpiredHtml(html)) {
    return {
      success: false,
      error: "Sesi LMS kedaluwarsa. Silakan putuskan koneksi lalu hubungkan kembali.",
    };
  }

  const $ = cheerio.load(html);
  const courses: LMSDashboardCourse[] = [];

  // Di /member, setiap mata kuliah ada di .box-widget.widget-user-2.card (di dalam .col-md-4)
  $(".box-widget.widget-user-2, .card.widget-user-2, .col-md-4 .box.card, .col-md-4 .box-widget").each(
    (_, el) => {
      const card = $(el);

      // URL pertemuan list: a[href*="/pertemuan/plist/"]
      const linkElem = card.find('a[href*="/pertemuan/plist/"]').first();
      const rawUrl = linkElem.attr("href") || card.find("a").first().attr("href") || "";
      if (!rawUrl || !rawUrl.includes("/pertemuan/plist/")) {
        return;
      }

      const url = toAbsoluteUrl(rawUrl);

      // Matkul name dari .header_badeg (contoh: "KB43J759 -E-Commerce +) #)")
      let matkul = card.find(".header_badeg").text().trim();
      if (!matkul) {
        matkul = card.find(".isi_badge").text().trim();
      }
      if (!matkul) {
        matkul = "Mata Kuliah";
      }

      // Dosen: .widget-user-username
      const dosen = card.find(".widget-user-username").text().trim() || "Dosen Pengampu";

      // HP: .widget-user-desc (contoh: "HP : 0816601717")
      const rawHp = card.find(".widget-user-desc").text().trim();
      const hp = rawHp ? rawHp.replace(/^HP\s*:\s*/i, "").trim() : null;

      // Foto dosen
      const photoRaw = card.find(".widget-user-image img").attr("src");
      const photo = photoRaw ? toAbsoluteUrl(photoRaw) : null;

      // Info kelas / ruang / jadwal dari .label.text-green
      const info = card.find(".label.text-green, .isi_badge .label").text().trim() || null;

      courses.push({
        matkul,
        dosen,
        hp: hp || null,
        photo: photo || null,
        info: info || null,
        url,
      });
    }
  );

  const nama =
    $(".user-panel .info p").first().text().trim() ||
    $(".user-header p").first().text().trim() ||
    undefined;

  const major = $(".content-header .badge").first().text().trim() || undefined;

  return {
    success: true,
    data: {
      nama,
      major,
      courses,
    },
  };
}

/**
 * Mem-parse HTML halaman /pertemuan/plist/[id] menjadi LMSMeetingsResponse
 */
export function parseMeetingsHTML(html: string): LMSMeetingsResponse {
  if (isSessionExpiredHtml(html)) {
    return {
      success: false,
      error: "Sesi LMS kedaluwarsa. Silakan putuskan koneksi lalu hubungkan kembali.",
    };
  }

  const $ = cheerio.load(html);
  const meetings: LMSMeeting[] = [];

  // Kartu pertemuan ada di .news-box.card
  $(".news-box.card, .col-md-3 .news-box").each((_, el) => {
    const card = $(el);

    const linkElem = card.find('a[href*="/pertemuan/pke/"]').first();
    const rawUrl = linkElem.attr("href") || "";
    if (!rawUrl) return;

    const url = toAbsoluteUrl(rawUrl);
    const name = card.find(".entry-title").text().trim() || "Pertemuan";
    const date = card.find(".entry-date").text().trim() || null;
    const desc =
      card.find(".inner-box").attr("title")?.trim() ||
      card.find(".entry-content").text().trim() ||
      null;

    meetings.push({
      name,
      url,
      date,
      desc,
    });
  });

  // Fallback: Jika tidak ada kartu .news-box, baca dari treeview menu di sidebar
  if (meetings.length === 0) {
    $("ul.treeview-menu a[href*='/pertemuan/pke/']").each((_, el) => {
      const a = $(el);
      const rawUrl = a.attr("href") || "";
      if (!rawUrl) return;

      const name = a.find("span").text().trim() || a.text().trim();
      meetings.push({
        name: name || "Pertemuan",
        url: toAbsoluteUrl(rawUrl),
        date: null,
        desc: null,
      });
    });
  }

  return {
    success: true,
    data: meetings,
  };
}

/**
 * Mem-parse HTML halaman /pertemuan/pke/[id] menjadi LMSContentsResponse
 */
export function parseContentsHTML(html: string): LMSContentsResponse {
  if (isSessionExpiredHtml(html)) {
    return {
      success: false,
      error: "Sesi LMS kedaluwarsa. Silakan putuskan koneksi lalu hubungkan kembali.",
    };
  }

  const $ = cheerio.load(html);
  const contents: LMSContent[] = [];

  // Materi & tugas ada di baris tabel .mailbox-messages table tbody tr
  $(".mailbox-messages table tbody tr").each((_, el) => {
    const tr = $(el);

    // Cari link download atau berkas
    const downloadLink = tr.find('a[href*="force_download"]').attr("href");
    const anyLink = tr.find("a[href]").attr("href");
    const rawUrl = downloadLink || (anyLink && !anyLink.startsWith("javascript") ? anyLink : null);
    const url = rawUrl ? toAbsoluteUrl(rawUrl) : null;

    // Nama file/materi ada di kolom teks .col-md-4 kedua, atau yang pertama jika hanya satu
    const col4s = tr.find(".col-md-4");
    let name = "";
    if (col4s.length > 1) {
      name = $(col4s[1]).text().trim();
    }
    if (!name && col4s.length > 0) {
      name = $(col4s[0]).text().trim();
    }
    if (!name) {
      name = tr.find(".mailbox-subject, .mailbox-name").text().trim();
    }
    if (!name) {
      name = tr.text().replace(/\s+/g, " ").trim();
    }

    if (!name) return;

    // Deteksi tipe: jika memuat kata "tugas", "assignment", "quiz" maka tipe 'tugas', selainnya 'materi'
    const lowerName = name.toLowerCase();
    const type =
      lowerName.includes("tugas") ||
      lowerName.includes("assignment") ||
      lowerName.includes("quiz")
        ? "tugas"
        : "materi";

    contents.push({
      type,
      name,
      url,
    });
  });

  return {
    success: true,
    data: contents,
  };
}
