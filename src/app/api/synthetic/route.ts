import { NextRequest, NextResponse } from "next/server";
import { createChatCompletion } from "@/lib/openrouter";
import type { ChatMessage } from "@/lib/openrouter";

interface CharacteristicTuple {
  name: string;
  values: string[];
}

interface GenerationRequest {
  count: number;
  characteristics: CharacteristicTuple[];
}

interface SyntheticProposal {
  id: string;
  characteristics: Record<string, string>;
  content: string;
}

function sampleCombinations(characteristics: CharacteristicTuple[], count: number): Record<string, string>[] {
  const combinations: Record<string, string>[] = [];

  for (let i = 0; i < count; i++) {
    const combination: Record<string, string> = {};

    for (const characteristic of characteristics) {
      if (characteristic.values.length > 0) {
        const randomIndex = Math.floor(Math.random() * characteristic.values.length);
        combination[characteristic.name] = characteristic.values[randomIndex];
      }
    }

    combinations.push(combination);
  }

  return combinations;
}

function createProposalPrompt(characteristics: Record<string, string>): string {
  const characteristicsList = Object.entries(characteristics)
    .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
    .join('\n');

  return `Generate a realistic synthetic proposal with the following characteristics:

${characteristicsList}

The proposal should be 2-3 paragraphs long and reflect these characteristics authentically. Include:
- A brief project overview
- Key technical approaches or methodologies
- Expected outcomes or deliverables
- Team composition hints (if relevant)
- Budget considerations (if relevant)

Make it sound like a real proposal submission that would naturally exhibit these characteristics. Do not explicitly mention the characteristics themselves in the content.`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as GenerationRequest;
    const { count, characteristics } = body;

    if (!count || count < 1 || count > 20) {
      return NextResponse.json(
        { error: "Count must be between 1 and 20" },
        { status: 400 }
      );
    }

    if (!characteristics || characteristics.length === 0) {
      return NextResponse.json(
        { error: "At least one characteristic is required" },
        { status: 400 }
      );
    }

    // Validate characteristics
    for (const characteristic of characteristics) {
      if (!characteristic.name || !characteristic.values || characteristic.values.length === 0) {
        return NextResponse.json(
          { error: "Each characteristic must have a name and at least one value" },
          { status: 400 }
        );
      }
    }

    // Sample combinations
    const combinations = sampleCombinations(characteristics, count);

    // Generate proposals
    const proposals: SyntheticProposal[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combination = combinations[i];
      const prompt = createProposalPrompt(combination);

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: "You are an AI that generates realistic synthetic proposal content for testing and training purposes. Create diverse, authentic-sounding proposals that naturally exhibit the specified characteristics without explicitly mentioning them."
        },
        {
          role: "user",
          content: prompt
        }
      ];

      try {
        const response = await createChatCompletion({
          messages,
          max_tokens: 800,
          temperature: 0.8,
        });

        const content = response.choices[0]?.message?.content || "";

        proposals.push({
          id: `synthetic-${Date.now()}-${i}`,
          characteristics: combination,
          content: content.trim()
        });
      } catch (error) {
        console.error(`Failed to generate proposal ${i + 1}:`, error);
        // Continue with other proposals even if one fails
        proposals.push({
          id: `synthetic-${Date.now()}-${i}`,
          characteristics: combination,
          content: `[Generation failed for this combination: ${error instanceof Error ? error.message : 'Unknown error'}]`
        });
      }
    }

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error("Synthetic proposal generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}