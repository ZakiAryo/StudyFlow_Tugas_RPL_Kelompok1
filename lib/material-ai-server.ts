import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export type MaterialTask = {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  priority: string;
  status: string;
  progress: number;
  course_id: string;
};

export type MaterialCourse = {
  id: string;
  name: string;
};

export type TaskMaterial = {
  id: string;
  user_id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  ai_breakdown: unknown | null;
  created_at: string;
  updated_at: string;
};

export type MaterialDocumentContext = {
  userId: string;
  task: MaterialTask;
  course: MaterialCourse | null;
  material: TaskMaterial;
  file: {
    data: string;
    mimeType: string;
  };
};

export async function createAuthenticatedSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function loadMaterialDocumentContext({
  materialId,
  taskId,
  userId,
}: {
  materialId: string;
  taskId: string;
  userId: string;
}): Promise<MaterialDocumentContext> {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    throw new Error("Environment Supabase belum lengkap.");
  }

  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id,title,description,deadline,priority,status,progress,course_id",
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) {
    throw taskError;
  }

  if (!taskData) {
    throw new Error("Tugas tidak ditemukan atau bukan milik user ini.");
  }

  const task = taskData as MaterialTask;

  const { data: materialData, error: materialError } = await supabase
    .from("task_materials")
    .select(
      "id,user_id,task_id,file_name,storage_path,mime_type,file_size,ai_breakdown,created_at,updated_at",
    )
    .eq("id", materialId)
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (materialError) {
    throw materialError;
  }

  if (!materialData) {
    throw new Error("Materi tidak ditemukan atau bukan milik user ini.");
  }

  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id,name")
    .eq("id", task.course_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (courseError) {
    throw courseError;
  }

  const material = materialData as TaskMaterial;
  const admin = createSupabaseAdminClient();
  const { data: fileData, error: downloadError } = await admin.storage
    .from("task-materials")
    .download(material.storage_path);

  if (downloadError) {
    throw downloadError;
  }

  if (!fileData) {
    throw new Error("File materi tidak bisa dibaca dari storage.");
  }

  const arrayBuffer = await fileData.arrayBuffer();

  return {
    userId,
    task,
    course: (courseData as MaterialCourse | null) ?? null,
    material,
    file: {
      data: Buffer.from(arrayBuffer).toString("base64"),
      mimeType: material.mime_type,
    },
  };
}
