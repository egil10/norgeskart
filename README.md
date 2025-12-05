# Norgeskart

🔗 **Live Demo:** [https://norgeskart-two.vercel.app/](https://norgeskart-two.vercel.app/)
 - Norske Historiske Personer

A beautiful, interactive timeline visualization of Norwegian historical persons built with SvelteKit and D3.js.

## Features

- 🎨 **Interactive Timeline**: Zoom and pan through Norwegian history
- 🔍 **Advanced Filtering**: Filter by occupation, year range, and search
- 📱 **Responsive Design**: Works beautifully on desktop and mobile
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 🖼️ **Rich Person Details**: View high-resolution images and detailed information
- ⚡ **Fast & Modern**: Built with SvelteKit for optimal performance

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd norgeskart
```

2. Install dependencies:
```bash
npm install
```

3. Generate person data (fetches from Wikidata):
```bash
# List available categories
npm run generate:data:list

# Fetch specific category (fast, recommended)
npm run generate:data -- --category=footballer
npm run generate:data -- --category=artist
npm run generate:data -- --category=writer

# Fetch all (slower, may timeout)
npm run generate:data

# Merge all category files into final dataset
npm run generate:data:merge
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (automatically runs data generation)
- `npm run preview` - Preview production build
- `npm run generate:data` - Scrape Wikipedia and regenerate person data
- `npm run check` - Run Svelte type checking

## Data Structure

Person data is stored in `src/lib/data/people.json` with the following structure:

```json
{
  "id": "person-id",
  "name": "Person Name",
  "birthYear": 1863,
  "deathYear": 1944,
  "imageUrl": "https://...",
  "wikipediaUrl": "https://...",
  "summary": "Brief biography...",
  "occupations": ["Occupation 1", "Occupation 2"],
  "color": "#hexcolor"
}
```

## Project Structure

```
src/
  lib/
    components/
      Timeline.svelte      # D3.js timeline visualization
      PersonPanel.svelte   # Person detail side panel
      Filters.svelte       # Filter sidebar
    data/
      fetchPeople.ts       # Wikipedia scraping script
      people.json          # Generated person data
    config/
      colors.ts            # Occupation color mapping
      occupations.ts       # Occupation types
  routes/
    +page.svelte          # Main application page
    +layout.svelte        # Root layout with dark mode
```

## Deployment

This project is configured for deployment on Vercel with zero configuration:

1. Push your code to GitHub
2. Import the project in Vercel
3. Deploy!

The build process automatically:
- Generates person data at build time
- Creates a static site (prerendered)
- Optimizes assets for production

## Technologies

- **SvelteKit** - Framework
- **D3.js** - Data visualization
- **TailwindCSS** - Styling
- **TypeScript** - Type safety
- **Cheerio** - HTML parsing for Wikipedia scraping

## License

MIT
