export type LMSDashboardCourse = {
  matkul: string;
  dosen: string;
  hp?: string | null;
  photo?: string | null;
  info?: string | null;
  url: string;
};

export type LMSDashboardResponse = {
  success: boolean;
  data?: {
    nama?: string;
    major?: string;
    courses?: LMSDashboardCourse[];
  };
  error?: string;
};

export type LMSMeeting = {
  name: string;
  url: string;
  date?: string | null;
  desc?: string | null;
};

export type LMSMeetingsResponse = {
  success: boolean;
  data?: LMSMeeting[];
  error?: string;
};

export type LMSContent = {
  type: string;
  name: string;
  url?: string | null;
};

export type LMSContentsResponse = {
  success: boolean;
  data?: LMSContent[];
  error?: string;
};