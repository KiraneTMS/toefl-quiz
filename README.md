# TOEFL Quiz (Pure HTML / CSS / JS + JSON)

A lightweight TOEFL-style practice web app.

## Features

- **Dashboard** – latest score + section progress bars
- **Practice modes**
  - Structure
  - Written Expression
  - Reading (passage + multiple questions)
  - Vocabulary
- **Setup options**: category, difficulty, question count
- **Two modes**
  - Practice → instant feedback + explanation
  - Test → results only at the end
- **Quick Quiz** (5 random questions)
- **Results** with weak-area summary
- **Mistake Review** (last 50 mistakes saved)
- **Progress tracking** (localStorage only – no server)

## How to run

Just open `index.html` in a modern browser.

Because the app loads JSON with `fetch`, you need a local server (browsers block `file://` fetch):

```bash
# Python
python -m http.server 8080

# or Node
npx serve .
```

Then visit `http://localhost:8080`.

## Question Bank

All questions live in `/data/*.json`.

You can freely add more questions following the existing schema.

### Structure / Vocabulary / Written Expression

```json
{
  "id": "str-013",
  "section": "structure",
  "category": "conditionals",
  "difficulty": "medium",
  "question": "If she _____ harder, she would have passed.",
  "options": ["studied", "had studied", "studies", "would study"],
  "correct": 1,
  "explanation": "Third conditional requires past perfect in the if-clause."
}
```

### Reading

One passage object contains multiple questions.

## Tech

- Pure HTML + CSS + Vanilla JS
- No frameworks, no build step
- Progress stored in `localStorage` under key `toefl_quiz_progress_v1`
