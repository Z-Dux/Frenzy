import { OpenRouter } from '@openrouter/sdk';

const openRouter = new OpenRouter({
  apiKey: '<OPENROUTER_API_KEY>',
});

  const result = await openRouter.chat.send({
    chatRequest: {
      maxTokens: 150,
      messages: [
        {
          content: "You are a helpful assistant.",
          role: "system",
        },
        {
          content: "What is the capital of France?",
          role: "user",
        },
      ],
      model: "openai/gpt-4",
      temperature: 0.7,
    },
  });


console.log(result);
