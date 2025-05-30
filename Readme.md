# Movie Summarizer Multi-Agent System

A smart multi-agent system that takes any movie title (even with typos or partial names) and creates detailed movie summaries saved as formatted text files.

## What It Does

- **Fixes Movie Titles**: Corrects spelling mistakes and completes partial titles (e.g., "uri bollywood" → "Uri: The Surgical Strike")
- **Fetches Movie Data**: Gets movie details from OMDB API including cast, ratings, plot, etc.
- **Creates Formatted Summaries**: Generates beautiful movie summary files with:
  - IMDb Rating
  - Main Cast (top 5 actors)
  - Movie Theme (genre, director)
  - Plot Summary
  - Enhanced AI analysis

## Setup

1. **Install Dependencies**:
   ```bash
   npm install @langchain/google-genai @langchain/core langchain zod dotenv
   ```

2. **Create `.env` File**:
   ```
   GOOGLE_API_KEY=your_google_api_key_here
   OMDB_API_KEY=your_omdb_api_key_here
   ```

3. **Get API Keys**:
   - **Google API**: [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **OMDB API**: [OMDB API](http://www.omdbapi.com/apikey.aspx) (free tier available)

4. **Add to package.json**:
   ```json
   {
     "type": "module"
   }
   ```

## How to Run

```bash
node movie-summarizer.js
```

## Usage

1. Start the program
2. Enter any movie title (typos and partial names are fine!)
3. The system will automatically:
   - Fix the movie title
   - Fetch movie details
   - Create a formatted summary file
4. Files are saved in `movie_summaries/` folder
5. Type `quit` to exit

## Example

```
Enter movie title: uri bollywood
✅ Movie summary successfully written to: /your/project/movie_summaries/Uri_The_Surgical_Strike_summary.txt
```

## File Output

Each movie gets a beautifully formatted text file with decorative borders containing all the movie details and AI-enhanced analysis.