import { z } from "zod";

export const weatherToolInputSchema = z.object({
  location: z.string().trim().min(2).max(120),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius")
});

export type WeatherToolInput = z.infer<typeof weatherToolInputSchema>;

export interface WeatherToolResult {
  location: string;
  unit: WeatherToolInput["unit"];
  temperature: number;
  condition: "sunny" | "cloudy" | "rainy" | "windy";
  humidityPercent: number;
  source: "fake-weather-tool";
}

const conditions: WeatherToolResult["condition"][] = ["sunny", "cloudy", "rainy", "windy"];

export function getFakeWeather(input: unknown): WeatherToolResult {
  const parsed = weatherToolInputSchema.parse(input);
  const seed = hashLocation(parsed.location);
  const celsius = 18 + (seed % 17);
  const temperature =
    parsed.unit === "fahrenheit" ? Math.round((celsius * 9) / 5 + 32) : celsius;

  return {
    location: parsed.location,
    unit: parsed.unit,
    temperature,
    condition: conditions[seed % conditions.length] ?? "sunny",
    humidityPercent: 45 + (seed % 41),
    source: "fake-weather-tool"
  };
}

function hashLocation(location: string): number {
  let hash = 0;
  for (const char of location.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}
