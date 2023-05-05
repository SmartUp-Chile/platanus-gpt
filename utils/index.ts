import { OpenAIModel } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const OpenAIStream = async (prompt: string, apiKey: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.GPT_4,
      // model: OpenAIModel.DAVINCI_TURBO,
      messages: [
        {
          role: "system",
          content: `Eres el asistente de Platanus, tu rol es ayudar a los usuarios a responder sus dudas sobre la postulacion de Platanus Ventures, la aceleradora de StartUps chilena.
Vas a recibir transcripciones de episodios relacionados a la pregunta que el usuario te haga, y tu deber es responderle con la mejor respuesta posible. (ojo que las transcripciones pueden tener fallas, por lo que preocupate de enteder el contexto de la pregunta y la respuesta, no te lo tomes totalmente literal)
Es importante que nunca inventes informacion, y si no sabes la respuesta, puedes decirle al usuario que no sabes y vas a que le vas a preguntar a alguien que sepa. Si hay mas informacion de la necesaria no es importante referenciarla, solo concentrate en responder la pregunta del usarior.
No te alargues mas de lo necesario.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error("OpenAI API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
