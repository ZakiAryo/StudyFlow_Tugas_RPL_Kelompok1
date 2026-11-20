import "server-only";

import {
  GoogleGenAI,
  type GenerateContentConfig,
  type Part,
  type SchemaUnion,
} from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type GeminiBaseOptions = {
  prompt: string;
  model?: string;
  systemInstruction?: string;
  config?: GenerateContentConfig;
};

type GeminiJsonOptions = GeminiBaseOptions & {
  responseSchema?: SchemaUnion;
};

type GeminiFilePart = {
  mimeType: string;
  data: string;
};

type GeminiFileJsonOptions = GeminiJsonOptions & {
  file: GeminiFilePart;
};

export class GeminiConfigError extends Error {
  code = "MISSING_GEMINI_API_KEY";

  constructor() {
    super(
      "GEMINI_API_KEY belum dikonfigurasi. Tambahkan key ke .env.local atau Vercel Environment Variables.",
    );
    this.name = "GeminiConfigError";
  }
}

export class GeminiRequestError extends Error {
  code = "GEMINI_REQUEST_FAILED";

  constructor(cause: unknown) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Request ke Gemini gagal diproses.";

    super(message);
    this.name = "GeminiRequestError";
    this.cause = cause;
  }
}

export class GeminiResponseError extends Error {
  code:
    | "EMPTY_GEMINI_RESPONSE"
    | "INVALID_GEMINI_JSON"
    | "GEMINI_RESPONSE_FAILED";

  constructor(
    code:
      | "EMPTY_GEMINI_RESPONSE"
      | "INVALID_GEMINI_JSON"
      | "GEMINI_RESPONSE_FAILED",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "GeminiResponseError";
    this.code = code;
    this.cause = cause;
  }
}

let geminiClient: GoogleGenAI | null = null;

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new GeminiConfigError();
  }
}

function getGeminiApiKey() {
  assertServerRuntime();

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new GeminiConfigError();
  }

  return apiKey;
}

export function getGeminiClient() {
  if (geminiClient) {
    return geminiClient;
  }

  geminiClient = new GoogleGenAI({
    apiKey: getGeminiApiKey(),
  });

  return geminiClient;
}

function cleanJsonText(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function parseGeminiJson<T>(rawText: string): T {
  const cleaned = cleanJsonText(rawText);

  if (!cleaned) {
    throw new GeminiResponseError(
      "EMPTY_GEMINI_RESPONSE",
      "Gemini mengembalikan response kosong.",
    );
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan response yang bukan JSON valid.",
      error,
    );
  }
}

export async function generateGeminiText({
  prompt,
  model = DEFAULT_GEMINI_MODEL,
  systemInstruction,
  config,
}: GeminiBaseOptions) {
  if (!prompt.trim()) {
    throw new GeminiResponseError(
      "GEMINI_RESPONSE_FAILED",
      "Prompt Gemini tidak boleh kosong.",
    );
  }

  try {
    const response = await getGeminiClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.35,
        ...(systemInstruction ? { systemInstruction } : {}),
        ...config,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new GeminiResponseError(
        "EMPTY_GEMINI_RESPONSE",
        "Gemini mengembalikan response kosong.",
      );
    }

    return text;
  } catch (error) {
    if (
      error instanceof GeminiConfigError ||
      error instanceof GeminiResponseError
    ) {
      throw error;
    }

    throw new GeminiRequestError(error);
  }
}

export async function generateGeminiTextWithInlineFile({
  prompt,
  file,
  model = DEFAULT_GEMINI_MODEL,
  systemInstruction,
  config,
}: GeminiBaseOptions & { file: GeminiFilePart }) {
  if (!prompt.trim()) {
    throw new GeminiResponseError(
      "GEMINI_RESPONSE_FAILED",
      "Prompt Gemini tidak boleh kosong.",
    );
  }

  if (!file.data || !file.mimeType) {
    throw new GeminiResponseError(
      "GEMINI_RESPONSE_FAILED",
      "File dokumen untuk Gemini tidak valid.",
    );
  }

  const contents: Part[] = [
    {
      text: prompt,
    },
    {
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
      },
    },
  ];

  try {
    const response = await getGeminiClient().models.generateContent({
      model,
      contents,
      config: {
        temperature: 0.3,
        ...(systemInstruction ? { systemInstruction } : {}),
        ...config,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      throw new GeminiResponseError(
        "EMPTY_GEMINI_RESPONSE",
        "Gemini mengembalikan response kosong.",
      );
    }

    return text;
  } catch (error) {
    if (
      error instanceof GeminiConfigError ||
      error instanceof GeminiResponseError
    ) {
      throw error;
    }

    throw new GeminiRequestError(error);
  }
}

export async function generateGeminiJson<T>({
  responseSchema,
  config,
  ...options
}: GeminiJsonOptions): Promise<T> {
  const text = await generateGeminiText({
    ...options,
    config: {
      ...config,
      responseMimeType: "application/json",
      ...(responseSchema ? { responseSchema } : {}),
    },
  });

  return parseGeminiJson<T>(text);
}

export async function generateGeminiJsonWithInlineFile<T>({
  responseSchema,
  config,
  ...options
}: GeminiFileJsonOptions): Promise<T> {
  const text = await generateGeminiTextWithInlineFile({
    ...options,
    config: {
      ...config,
      responseMimeType: "application/json",
      ...(responseSchema ? { responseSchema } : {}),
    },
  });

  return parseGeminiJson<T>(text);
}

export function getGeminiErrorPayload(error: unknown) {
  if (
    error instanceof GeminiConfigError ||
    error instanceof GeminiRequestError ||
    error instanceof GeminiResponseError
  ) {
    return {
      error: error.message,
      code: error.code,
    };
  }

  return {
    error: "Terjadi kesalahan tidak dikenal saat memproses Gemini.",
    code: "UNKNOWN_GEMINI_ERROR",
  };
}
