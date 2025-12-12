import fs from 'fs';
import path from 'path';

/**
 * Copy directory recursively
 */
export const copyRecursiveSync = (src: string, dest: string): void => {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const files = fs.readdirSync(src);
        files.forEach(file => {
            copyRecursiveSync(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
};

/**
 * Transform questions JSON to use "decision" and "rejected_alternatives" format
 * This provides clarity for downstream agents by explicitly showing what was chosen
 * and what was intentionally rejected.
 * 
 * Transforms from:
 * { question: "...", options: ["A", "B", "C"], answer: "B" }
 * 
 * To:
 * { question: "...", decision: "B", rejected_alternatives: ["A", "C"] }
 * 
 * @param questionsData - The questions data object with questions array
 * @returns Transformed questions data
 */
export const transformQuestionsFormat = (questionsData: any): any => {
    if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
        return questionsData;
    }

    const transformedQuestions = questionsData.questions.map((q: any) => {
        // If the question has options and an answer, transform it
        if (q.options && Array.isArray(q.options) && q.answer) {
            const rejected = q.options.filter((opt: string) => opt !== q.answer);
            
            return {
                question: q.question,
                decision: q.answer,
                rejected_alternatives: rejected.length > 0 ? rejected : undefined
            };
        }
        
        // If no options array, just rename "answer" to "decision" if it exists
        if (q.answer && !q.options) {
            const { answer, ...rest } = q;
            return {
                ...rest,
                decision: answer
            };
        }
        
        // Return as-is if neither pattern matches
        return q;
    });

    return {
        ...questionsData,
        questions: transformedQuestions
    };
};

