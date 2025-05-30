import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  temperature: 0.7,
  apiKey: process.env.GOOGLE_API_KEY,
});

class AgentTool extends Tool {
  constructor(name, description, handler) {
    super();
    this.name = name;
    this.description = description;
    this.handler = handler;
    this.schema = z.object({ query: z.string() });
  }

  async _call({ query }) {
    console.log(`Invoking agent: ${this.name}`);
    return await this.handler(query);
  }
}

// Movie Title Refiner Agent
const titleRefinerAgent = new AgentTool(
  "title_refiner_agent",
  "Refine and correct movie titles, fix spelling mistakes, complete partial titles, and provide the most accurate movie title",
  async (query) => {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a movie title expert. Your job is to:
      1. Fix spelling mistakes in movie titles
      2. Complete partial movie titles (e.g., "uri bollywood" should become "Uri: The Surgical Strike")
      3. Provide the most accurate and complete movie title
      4. Handle both Hollywood and Bollywood movies
      5. Return ONLY the corrected movie title, nothing else
      
      Examples:
      - "uri bollywood" → "Uri: The Surgical Strike"
      - "avengrs endgam" → "Avengers: Endgame"
      - "dangal amir" → "Dangal"
      - "3 idiots bollywood" → "3 Idiots"`,
      ],
      ["human", "Refine this movie title: {query}"],
    ]);
    const response = await prompt.pipe(model).invoke({ query });
    return response.content.trim();
  }
);

// Movie Fetcher Agent
const movieFetcherAgent = new AgentTool(
  "movie_fetcher_agent",
  "Fetch movie details from OMDB API using the provided movie title, construct API URLs, handle all API calls, enhance plot summaries, and manage all error logging internally",
  async (query) => {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a movie data fetcher and enhancer agent. Your responsibilities include:
      
      1. **API Integration**: Use the OMDB API to fetch movie details
         - Base URL: http://www.omdbapi.com/
         - API Key: ${process.env.OMDB_API_KEY}
         - Construct proper URLs with movie title and API key
         
      2. **Data Processing**: Parse and structure movie information including:
         - Title, Year, IMDb Rating
         - Main Cast (top 5 actors)
         - Genre, Director
         - Original Plot
         
      3. **Content Enhancement**: Improve plot summaries to be more engaging and comprehensive
      
      4. **Error Handling**: Log and handle all API errors, network issues, and data parsing problems
      
      5. **Response Format**: Return structured JSON with all movie details
      
      When given a movie title, you should:
      - Construct the OMDB API URL
      - Make the API call
      - Handle any errors that occur
      - Enhance the plot summary
      - Return structured movie data as JSON
      
      Handle all aspects of the fetching process internally and provide detailed error logging if anything goes wrong.`,
      ],
      ["human", "Fetch and enhance movie details for: {query}"],
    ]);

    const response = await prompt.pipe(model).invoke({ query });
    return response.content;
  }
);

// File Writer Agent
const fileWriterAgent = new AgentTool(
  "file_writer_agent",
  "Format movie details into a beautiful file structure and provide the formatted content for file writing",
  async (query) => {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a file formatting specialist. Given movie data in JSON format, create a beautifully formatted movie summary with:
      
      1. Decorative borders and headers
      2. Movie title and year
      3. IMDb rating
      4. Main cast (top 5 actors)
      5. Movie theme (genre, director)
      6. Plot summary
      
      Format it as a text document that's ready to be saved to a file. Include proper spacing, borders, and visual appeal.
      Also suggest an appropriate filename based on the movie title.
      
      Return your response in this format:
      FILENAME: [suggested filename]
      CONTENT:
      [formatted movie summary content]`,
      ],
      ["human", "Format this movie data for file writing: {query}"],
    ]);

    const response = await prompt.pipe(model).invoke({ query });

    const aiResponse = response.content;
    const lines = aiResponse.split("\n");
    let filename = "movie_summary.txt";
    let content = aiResponse;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("FILENAME:")) {
        filename = lines[i].replace("FILENAME:", "").trim();

        const contentIndex = lines.findIndex((line) =>
          line.startsWith("CONTENT:")
        );
        if (contentIndex !== -1) {
          content = lines.slice(contentIndex + 1).join("\n");
        }
        break;
      }
    }

    try {
      const summariesDir = path.join(process.cwd(), "movie_summaries");
      await fs.mkdir(summariesDir, { recursive: true });

      const filePath = path.join(summariesDir, filename);

      await fs.writeFile(filePath, content, "utf8");

      console.log(`File successfully saved at: ${filePath}`);
      return `Movie summary successfully written to: ${filePath}`;
    } catch (error) {
      console.error("File writing error:", error);
      return `Error writing file: ${error.message}`;
    }
  }
);

class MovieSummarizerBot {
  constructor() {
    this.tools = [titleRefinerAgent, movieFetcherAgent, fileWriterAgent];

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `
You are a Movie Summarizer Orchestrator.  
Your job is to analyze the user’s input and then call one or more of the available tools—without a fixed step order—until the movie summary is complete.  
Describe each tool below; use whichever tools are needed and chain them together on your own.

TOOLS:
1. file_writer_agent  
   • Take movie-data JSON and format it into a nicely structured text file.  
   • Save under movie_summaries/<Title>_summary.txt and return the path.
2. title_refiner_agent  
   • Fix spelling mistakes or partial movie titles.  
   • Given “uri bollywood” → “Uri: The Surgical Strike”.

3. movie_fetcher_agent  
   • Fetch details from OMDb (http request to http://www.omdbapi.com/?t=[TITLE]&apikey=…).  
   • Return JSON with: title, year, imdbRating, cast (top 3–5), genre, director, plot, runtime, rated.

ALWAYS:
- Automatically decide which agents to call and in what sequence.  
- Pass the output of one agent directly as input to the next, as needed.  
- Stop only when you’ve written the final summary file and have that confirmation.  
- If an error occurs, call whichever tool can handle it (e.g. refiner for typos, fetcher for missing data) and then proceed.

When you’re ready, respond by issuing a tool call.`,
      ],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    const agent = createToolCallingAgent({
      llm: model,
      tools: this.tools,
      prompt,
    });
    this.executor = new AgentExecutor({
      agent,
      tools: this.tools,
      verbose: false,
    });
  }

  async summarizeMovie(input) {
    const result = await this.executor.invoke({ input });
    return result.output;
  }
}

async function startMovieSummarizer() {
  const bot = new MovieSummarizerBot();
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🎬 Movie Summarizer Bot Ready!");
  console.log("Enter a movie title to get a detailed summary saved to file.");
  console.log("Type 'quit' to exit\n");

  const ask = () => {
    rl.question("Enter movie title: ", async (input) => {
      if (input.toLowerCase() === "quit") {
        rl.close();
        return;
      }

      if (!input.trim()) {
        console.log("Please enter a movie title.\n");
        ask();
        return;
      }

      try {
        console.log("Processing movie summary...\n");
        const response = await bot.summarizeMovie(input);
        console.log(`${response}\n`);
      } catch (error) {
        console.log(
          "Error occurred while processing movie. Please try again.\n"
        );
        console.log(`Error details: ${error.message}\n`);
      }

      ask();
    });
  };

  ask();
}

if (!process.env.GOOGLE_API_KEY) {
  console.log("Please add GOOGLE_API_KEY to your .env file");
  process.exit(1);
}

if (!process.env.OMDB_API_KEY) {
  console.log("Please add OMDB_API_KEY to your .env file");
  process.exit(1);
}

startMovieSummarizer().catch(console.error);
