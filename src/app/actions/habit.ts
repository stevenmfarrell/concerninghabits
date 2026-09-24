'use server';

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
import { z } from 'zod';

export async function generateHabitSchema(prompt: string, currentSchema?: any) {
  try {
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      maxRetries: 0,
      system: `You are an expert at creating JSON Schemas for dynamic forms. 
      Given a description of a habit, generate a valid JSON schema (draft-07) to collect the required data. 
      The schema MUST be of type 'object'. Provide human-readable titles for fields.
      CRITICAL INSTRUCTION: For simple event-based habits (e.g., "take my medicine", "drank water"), the 'properties' object MUST be completely empty ({}). DO NOT add checkboxes, confirmation booleans, or any other fields. The presence of the log entry itself confirms the event.
      CRITICAL INSTRUCTION: Keep the habit title extremely short and concise. Do NOT prefix the title with words like "Track", "Log", or "Record". (e.g. use "Morning Run" instead of "Track morning run").
      For complex habits, define the properties (e.g., distance, time, notes).
      
      ${currentSchema ? `The user wants to tweak an existing schema. Here is the current schema:\n${JSON.stringify(currentSchema, null, 2)}\nUpdate it according to their new instructions. Preserve the existing title unless asked to change it.` : ''}`,
      prompt: `User instructions: ${prompt}`,
      schema: z.object({
        title: z.string().describe("A short, concise name for the habit. Do NOT prefix with 'Track' or 'Log'."),
        category: z.enum(['Mind', 'Body', 'Chores', 'Other']).describe("The category this habit best fits into"),
        frequency: z.enum(['daily', 'weekly', 'monthly', 'multiple']).optional().describe("The suggested tracking cadence"),
        type: z.literal('object'),
        properties: z.record(z.any()).describe("The fields required to track this habit. Keep it simple. Use empty {} for simple boolean tasks."),
        required: z.array(z.string()).optional().describe("Array of required property keys"),
      }),
    });

    return { success: true, schema: object, category: object.category };
  } catch (error) {
    console.error("Error generating schema:", error);
    return { success: false, error: "Failed to generate schema." };
  }
}
