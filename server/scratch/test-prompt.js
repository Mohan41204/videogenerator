const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const cleanJsonString = (str) => {
  if (!str) return '';
  const arrayMatch = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    str = arrayMatch[0];
  } else {
    const objectMatch = str.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      str = objectMatch[0];
    }
  }
  str = str.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '');
  str = str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
  return str.trim();
};

const test = async () => {
  const topic = 'Python Loops';
  const subTopic = 'While Loops';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const prompt = `
Imagine you are an experienced classroom teacher creating detailed spoken study notes for students.

Your task is to generate a complete teaching script for the topic: "${topic}".
The subtopic to focus on is: "${subTopic || 'General Concepts'}".

Requirements for the teaching style:
- The script must teach students from beginner level to advanced understanding step by step.
- CRITICAL: Determine if the topic and subtopic are related to programming, coding, software engineering, databases, APIs, frameworks, markup languages, styling languages, or technical computer science concepts (e.g., Python, Java, Javascript, HTML/CSS, React, SQL, Git, Loops, OOP, Algorithms, Web Development, etc.):
  - **If the topic/subtopic is programming/coding-related, you MUST include actual, concrete example coding snippets**:
    - For every core concept/subconcept of the topic (e.g., if topic is "Python" and subtopic is "OOPS", core concepts would be Class & Object, Encapsulation, Inheritance, Polymorphism, Abstraction, etc.):
      - Provide at least one slide with a **Basic Example Program** showing the fundamental implementation.
      - Provide at least one slide with an **Advanced Example Program** showing real-world / production-grade implementation.
      - Make sure the example programs are complete, realistic, and directly show the concepts in action.
    - For slides displaying code examples, the \`bullets\` array should contain exactly one string representing the full, formatted, and indented code block. Use \\N (the literal string '\\N') to represent newlines inside the code block so that lines and spacing are perfectly preserved on the screen. Do NOT include markdown code fences (\`\`\`) inside the bullets array. Write real, complete, professional code snippets (e.g., \`"class Dog:\\\\N    def __init__(self, name):\\\\N        self.name = name"\`).
    - The slide object MUST have "isCode": true.
  - **If the topic/subtopic is NOT related to programming/coding**:
    - Do NOT include any programming code blocks or example programs.
    - Instead, generate detailed explanation slides, and if possible, include concrete real-world examples, analogies, practical case studies, and scenarios related to the topic and subtopic.
    - The slide object MUST have "isCode": false.
    - CRITICAL CONTENT GENERATION RULES FOR NOTEPAD SLIDES:
      - The \`bullets\` array MUST contain 2 to 4 plain text paragraphs (strings) containing natural explanations, written like a real instructor typing notes live.
      - NEVER generate bullet points or use bullet symbols (like •, -, *).
      - NEVER generate numbered lists, tables, markdown formatting, or code fences (\`\`\`).
      - Use natural, conversational English. Keep sentences short and clear. Explain concepts progressively.
      - Avoid headings unless absolutely necessary.
- Explain every concept and example in a very simple, easy-to-understand classroom teaching style.
- Use friendly teacher-to-student communication.
- Include real-world examples, analogies, practical explanations, and small exercises where appropriate.
- Cover definitions, theory, syntax, examples, use cases, common mistakes, and interview-oriented understanding.
- The explanation should feel like a real classroom session where a teacher explains concepts slowly and clearly.
- Keep the flow natural and engaging so students can easily follow along in a video lesson.
- The generated content must be long and detailed enough for at least a 30-minute MP4 educational video narration.
- Maintain continuity between topics and subtopics.
- Avoid short summaries; provide deep explanations with beginner-friendly teaching.
 
OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of "Slide" objects. Do not include markdown formatting, headings symbols, or code block formatting outside the JSON. Do not include phrases like "fade in", "pause", "screen shows". Just raw JSON array.
Each Slide object must have:
- "heading": (String) A short, professional title for the slide.
- "subheading": (String) An optional subtitle or secondary thought. Can be empty string.
- "bullets": (Array of Strings) Content to display on the slide.
  - For programming code slides (\`isCode\`: true), the array MUST contain exactly one string representing the code block.
  - For explanation/Notepad slides (\`isCode\`: false), the array MUST contain 2 to 4 strings, where each string is a complete, natural paragraph of notes typed live. Do NOT use bullet symbols (like •, -, *), numbered lists, tables, code blocks, or markdown.
- "narration": (String) The long, detailed spoken teaching script for this slide matching all the teaching style requirements above. Output plain narration text only for this field.
- "isCode": (Boolean) Set to true if this slide is a code example or contains code, and false otherwise.
`;

  console.log('Sending request to Gemini with Schema...');
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            subheading: { type: 'string' },
            bullets: {
              type: 'array',
              items: { type: 'string' }
            },
            narration: { type: 'string' },
            isCode: { type: 'boolean' }
          },
          required: ['heading', 'subheading', 'bullets', 'narration', 'isCode']
        }
      }
    }
  });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  const cleaned = cleanJsonString(text);
  try {
    const parsed = JSON.parse(cleaned);
    console.log('Successfully parsed script JSON. Total slides:', parsed.length);
  } catch (err) {
    console.error('Failed to parse cleaned JSON:', err.message);
    const match = err.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const start = Math.max(0, pos - 100);
      const end = Math.min(cleaned.length, pos + 100);
      console.log('--- ERROR CONTEXT ---');
      console.log(cleaned.substring(start, pos) + ' >>> ' + cleaned[pos] + ' <<< ' + cleaned.substring(pos + 1, end));
      console.log('---------------------');
    }
  }
};

test().catch(console.error);
