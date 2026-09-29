'use server';

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
import { z } from 'zod';
import { getDefaultUser, getCategories } from './db';
import { buildCategoryChoices } from '@/lib/categoryChoices';
import type { HabitSchema } from '@/lib/types';

export async function generateHabitSchema(prompt: string, currentSchema?: HabitSchema) {
  const user = await getDefaultUser();

  // Let the AI choose from the user's own categories, then map its choice back to an id
  const categoryIdsByLabel = buildCategoryChoices(await getCategories());
  const categoryLabels = [...categoryIdsByLabel.keys()];
  const categorySchema = categoryLabels.length > 0
    ? z.enum(categoryLabels as [string, ...string[]]).describe(
        "The user's category this habit best fits into. Subcategories are written 'Parent:Child' (e.g. 'Fitness:Cardio' is the Cardio subcategory of Fitness). Prefer the most specific subcategory that fits; use the parent category when no subcategory fits."
      )
    : z.null();

  try {
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      maxRetries: 0,
      system: `You are an expert at creating JSON Schemas for dynamic forms. 
      Given a description of a habit, generate a valid JSON schema (draft-07) to collect the required data. 
      The schema MUST be of type 'object'. Provide human-readable titles for fields.
      CRITICAL INSTRUCTION: For simple event-based habits (e.g., "take my medicine", "drank water"), the 'properties' object MUST be completely empty ({}). DO NOT add checkboxes, confirmation booleans, or any other fields. The presence of the log entry itself confirms the event.
      CRITICAL INSTRUCTION: Keep the habit title extremely short and concise. Do NOT prefix the title with words like "Track", "Log", or "Record". (e.g. use "Morning Run" instead of "Track morning run").
      ${user.useEmojiTitle ? `CRITICAL INSTRUCTION: You MUST put exactly one relevant emoji at the very start of the habit title (e.g., "🏃 Morning Run"). ${user.emojiModifier ? `The user requested the following style/modifiers for emojis: "${user.emojiModifier}". (e.g. skin tone, gender). Apply this whenever applicable.` : ''}` : 'CRITICAL INSTRUCTION: Do NOT include any emojis in the habit title.'}
      For complex habits, define the properties (e.g., distance, time, notes).
      
      ${currentSchema ? `The user wants to tweak an existing schema. Here is the current schema:\n${JSON.stringify(currentSchema, null, 2)}\nUpdate it according to their new instructions. Preserve the existing title unless asked to change it.` : ''}`,
      prompt: `User instructions: ${prompt}`,
      schema: z.object({
        title: z.string().describe(`A short, concise name for the habit. Do NOT prefix with 'Track' or 'Log'. ${user.useEmojiTitle ? 'MUST start with a relevant emoji.' : 'NO emojis.'}`),
        category: categorySchema.optional(),
        frequency: z.enum(['daily', 'weekly', 'monthly', 'multiple']).optional().describe("The suggested tracking cadence"),
        type: z.literal('object'),
        properties: z.record(z.string(), z.any()).describe(`The fields required. Keep it simple. Use empty {} for simple boolean tasks. CRITICAL: For time durations, set 'type': 'number' AND 'x-widget': 'duration'. For other numeric fields, include an 'x-unit' key specifying the unit of measurement (e.g., 'miles', 'lbs', 'oz', 'pages'). The user prefers the ${user.unitSystem} measurement system.`),
        required: z.array(z.string()).optional().describe("Array of required property keys"),
      }),
    });

    // category and frequency are suggestions for the editor, not part of the habit's form schema
    const { category, frequency, ...schema } = object;
    return {
      success: true,
      schema,
      frequency,
      categoryId: category ? categoryIdsByLabel.get(category) : undefined,
    };
  } catch (error) {
    console.error("Error generating schema:", error);
    return { success: false, error: "Failed to generate schema." };
  }
}

export async function parseVoiceLog(schemaStr: string, transcript: string) {
  await getDefaultUser();

  try {
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      schema: z.record(z.string(), z.any()),
      system: `You are an AI assistant that extracts structured data from a user's voice transcript to fill out a habit tracking form.
You are given the JSON schema for the form.
You must map the transcript to the schema's 'properties'.
Return ONLY a flat JSON object where the keys exactly match the property keys from the schema, and the values are the extracted data.
DO NOT nest your response inside a 'properties' key.
If the transcript implies a value that matches a field, include it. Otherwise omit it.
CRITICAL: A property with "x-widget": "duration" must be returned as TOTAL MINUTES, as a decimal number — e.g. "90 seconds" is 1.5, "2 hours 30 minutes" is 150, "25 minutes 30 seconds" is 25.5. Never return seconds or an "HH:MM:SS" string for these fields.`,
      prompt: `Form Schema:\n${schemaStr}\n\nVoice Transcript:\n"${transcript}"`,
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("Error parsing voice log:", error);
    return { success: false, error: "Failed to parse voice log." };
  }
}

export async function parseImageLog(schemaStr: string, base64Image: string) {
  await getDefaultUser();

  try {
    const base64Data = base64Image.split(',')[1];
    
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      schema: z.record(z.string(), z.any()),
      system: `You are an AI assistant that extracts structured data from an image to fill out a habit tracking form.
You are given the JSON schema for the form.
Analyze the image (e.g. a treadmill screen, a handwritten log, a meal) and map the relevant information to the schema's 'properties'.
Return ONLY a flat JSON object where the keys exactly match the property keys from the schema, and the values are the extracted data.
DO NOT nest your response inside a 'properties' key.
If the image implies a value that matches a field, include it. Otherwise omit it.
CRITICAL: A property with "x-widget": "duration" must be returned as TOTAL MINUTES, as a decimal number — e.g. "90 seconds" is 1.5, "2 hours 30 minutes" is 150, "25 minutes 30 seconds" is 25.5. Never return seconds or an "HH:MM:SS" string for these fields.`,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Form Schema:\n${schemaStr}\n\nExtract the relevant data from this image.` },
            { type: 'image', image: base64Data }
          ],
        },
      ],
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("Error parsing image log:", error);
    return { success: false, error: "Failed to parse image log." };
  }
}
