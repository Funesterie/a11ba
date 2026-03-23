import OpenAI from "openai";

export async function askOpenAI(prompt: string, model = "gpt-5.1") {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "user", content: prompt }
    ]
  });

  return response.choices[0].message.content;
}
