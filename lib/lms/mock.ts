import type {
  LMSContent,
  LMSDashboardCourse,
  LMSMeeting,
} from "./types";

export type MockLMSCourse = LMSDashboardCourse & {
  meetings: LMSMeeting[];
  contents: Record<string, LMSContent[]>;
};

export const mockLMSCourses: MockLMSCourse[] = [
  {
    matkul: "E-Commerce",
    dosen: "Dosen E-Commerce",
    hp: null,
    photo: null,
    info: "Kelas: RV | Ruang: Online",
    url: "mock://course/e-commerce",
    meetings: [
      {
        name: "Pertemuan 01 - E-Commerce",
        url: "mock://meeting/e-commerce/01",
        date: "08 September 2026",
        desc:
          "Pengertian E-Commerce, manfaat E-Commerce, perkembangan E-Commerce dan E-Bisnis.",
      },
      {
        name: "Pertemuan 02 - Model Bisnis",
        url: "mock://meeting/e-commerce/02",
        date: "15 September 2026",
        desc:
          "Model bisnis dalam E-Commerce dan penerapannya.",
      },
    ],
    contents: {
      "mock://meeting/e-commerce/01": [
        {
          type: "materi",
          name: "Modul 1 - E-Commerce.pdf",
          url: "mock://content/modul-ecommerce-01",
        },
        {
          type: "materi",
          name: "Materi Pertemuan 1",
          url: "mock://content/materi-ecommerce-01",
        },
        {
          type: "tugas",
          name: "Tugas Kelompok Ke 1",
          url: "mock://content/tugas-ecommerce-01",
        },
      ],
      "mock://meeting/e-commerce/02": [
        {
          type: "materi",
          name: "Modul 2 - Model Bisnis.pdf",
          url: "mock://content/modul-ecommerce-02",
        },
      ],
    },
  },
  {
    matkul: "Rekayasa Perangkat Lunak",
    dosen: "Dosen RPL",
    hp: null,
    photo: null,
    info: "Kelas: RV | Ruang: Online",
    url: "mock://course/rpl",
    meetings: [
      {
        name: "Pertemuan 01 - Konsep RPL",
        url: "mock://meeting/rpl/01",
        date: "09 September 2026",
        desc:
          "Pengantar Rekayasa Perangkat Lunak dan siklus pengembangan perangkat lunak.",
      },
    ],
    contents: {
      "mock://meeting/rpl/01": [
        {
          type: "materi",
          name: "Modul RPL Pertemuan 1.pdf",
          url: "mock://content/modul-rpl-01",
        },
        {
          type: "tugas",
          name: "Tugas Analisis Sistem",
          url: "mock://content/tugas-rpl-01",
        },
      ],
    },
  },
];