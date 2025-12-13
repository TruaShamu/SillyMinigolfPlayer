/**
 * Report Generator Module
 * Generates entertaining game session reports with witty commentary
 * Uses local LLM (Phi) for report generation
 */

import fs from 'fs';
import path from 'path';
import { LocalLLMService } from '../services/LocalLLMService.js';

export class ReportGenerator {
    constructor(outputDir = './reports') {
        this.outputDir = outputDir;
        this.llmService = new LocalLLMService();
        this.ensureOutputDir();
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate a timestamp for filenames
     */
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    /**
     * Generate the full playtest report (async version)
     */
    async generate(data) {
        const {
            sessionData,
            bugSummary,
            critique,
            shotHistory = [],
            courseLayout,
            finalState,
            sessionDuration = 0,
            outcome = 'Unknown'
        } = data;

        const timestamp = this.getTimestamp();
        const gameName = courseLayout?.name || 'Unknown Game';

        // Generate Markdown report with LLM
        const markdown = await this.generateMarkdown({
            gameName,
            timestamp,
            sessionDuration,
            outcome,
            shotHistory,
            bugSummary,
            critique,
            courseLayout,
            finalState
        });

        // Generate JSON report
        const json = {
            meta: {
                gameName,
                timestamp,
                generatedAt: new Date().toISOString(),
                version: '1.0.0'
            },
            session: {
                duration: sessionDuration,
                outcome,
                strokes: shotHistory.length,
                finalState
            },
            bugs: bugSummary,
            critique,
            shotHistory,
            courseLayout
        };

        // Save reports
        const mdPath = path.join(this.outputDir, `${timestamp}_${gameName.replace(/\s+/g, '_')}.md`);
        const jsonPath = path.join(this.outputDir, `${timestamp}_${gameName.replace(/\s+/g, '_')}.json`);

        fs.writeFileSync(mdPath, markdown);
        fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));

        console.log(`\n📄 Reports saved:`);
        console.log(`   Markdown: ${mdPath}`);
        console.log(`   JSON: ${jsonPath}`);

        return { mdPath, jsonPath, markdown, json };
    }

    /**
     * Generate Markdown report with witty commentary using Phi3
     */
    async generateMarkdown(data) {
        const {
            gameName,
            timestamp,
            sessionDuration = 0,
            outcome = 'Unknown',
            shotHistory = [],
            bugSummary = { total: 0, bySeverity: { critical: 0, high: 0 }, bugs: [] },
            critique,
            courseLayout,
            finalState = {}
        } = data;

        // Enrich shot history with computed metrics if not already present
        const enrichedShotHistory = shotHistory.map((shot, idx) => {
            if (shot.distanceChange !== undefined) return shot;
            
            // Calculate from state snapshots if available
            const state = shot.state;
            if (!state) return shot;
            
            const holePos = { x: state.holeX || 0, z: state.holeZ || 0 };
            const ballPos = { x: state.ball?.x || 0, z: state.ball?.z || 0 };
            const distanceToHole = Math.sqrt(
                (ballPos.x - holePos.x) ** 2 + 
                (ballPos.z - holePos.z) ** 2
            );
            
            // Estimate distance change from previous state
            let distanceChange = 0;
            if (idx > 0 && shotHistory[idx - 1].state) {
                const prevState = shotHistory[idx - 1].state;
                const prevHolePos = { x: prevState.holeX || 0, z: prevState.holeZ || 0 };
                const prevBallPos = { x: prevState.ball?.x || 0, z: prevState.ball?.z || 0 };
                const prevDistance = Math.sqrt(
                    (prevBallPos.x - prevHolePos.x) ** 2 + 
                    (prevBallPos.z - prevHolePos.z) ** 2
                );
                distanceChange = distanceToHole - prevDistance;
            }
            
            return {
                ...shot,
                distanceChange,
                ballBefore: idx > 0 ? shotHistory[idx - 1].state?.ball : undefined,
                ballAfter: state.ball
            };
        });

        const totalStrokes = enrichedShotHistory.length;
        const shotsImproved = enrichedShotHistory.filter(s => s.distanceChange && s.distanceChange < 0).length;
        const avgDistance = totalStrokes > 0
            ? enrichedShotHistory.reduce((sum, s) => {
                if (s.ballAfter && s.ballBefore && s.ballBefore.x && s.ballAfter.x) {
                    const dist = Math.sqrt(
                        (s.ballAfter.x - s.ballBefore.x) ** 2 + 
                        (s.ballAfter.z - s.ballBefore.z) ** 2
                    );
                    return sum + dist;
                }
                return sum;
            }, 0) / totalStrokes
            : 0;
        const wallBounces = enrichedShotHistory.filter(s => s.distanceChange && s.distanceChange > 1).length;
        const perfectRatePercent = totalStrokes > 0 ? ((shotsImproved/totalStrokes)*100).toFixed(0) : 0;

        // Dramatic moments
        const regressions = enrichedShotHistory.filter(s => s.distanceChange && s.distanceChange > 2);
        const greatShots = enrichedShotHistory.filter(s => s.distanceChange && s.distanceChange < -3);
        const nearMisses = enrichedShotHistory.filter(s => !s.distanceChange || (s.distanceChange > -1 && s.distanceChange < 1));

        // Generate witty summary using Phi3
        let whatHappened = await this.generateOutcomeSummary(
            outcome,
            totalStrokes,
            sessionDuration,
            regressions.length,
            greatShots.length
        );

        let dramaticMoments = '';
        if (greatShots.length > 0) {
            dramaticMoments += `\n**⭐ My Best Moments:** ${greatShots.length} shots I'm genuinely proud of where I got the ball ${greatShots.map(s => Math.abs(s.distanceChange).toFixed(1)).join(', ')} units closer. Those felt *good*.`;
        }
        if (regressions.length > 0) {
            dramaticMoments += `\n**💥 Oops Moments:** ${regressions.length} time(s) I somehow sent the ball *further* away. What was I thinking?? Physics is confusing.`;
        }
        if (wallBounces > 2) {
            dramaticMoments += `\n**🏌️ Wall Bounce Tour:** I hit walls ${wallBounces} times. Not my proudest moments, but hey, at least I was exploring the course!`;
        }
        if (nearMisses.length > 2) {
            dramaticMoments += `\n**😬 The Gentle Taps:** ${nearMisses.length} shots where I basically nudged the ball. Was that confidence or just a bad call? We may never know.`;
        }

        // Generate LLM-based drama commentary before building markdown
        const dramaSection = await this.generateDrama(enrichedShotHistory, outcome);

        // Build markdown with personality (from companion's perspective)
        return `# 🎮 My Session Report: ${gameName}

**When:** ${timestamp.replace('T', ' ')}  
**How Long:** ${(sessionDuration / 1000).toFixed(1)} seconds of pure gaming focus  
**The Result:** ${outcome} in ${totalStrokes} strokes

---

## What Just Happened?

${whatHappened}

---

## By The Numbers (If You Care About That Stuff)

| Stat | Value | My Take |
|------|-------|---------|
| **Total Strokes** | ${totalStrokes} | ${totalStrokes <= 3 ? 'Absolutely crushing it' : totalStrokes <= 6 ? 'Pretty respectable' : 'Hey, I tried my best'} |
| **Success Rate** | ${perfectRatePercent}% | ${perfectRatePercent >= 80 ? '✨ I made solid choices' : perfectRatePercent >= 50 ? '🤔 Mixed bag of decisions' : '😅 Yeah, I had some rough moments'} |
| **Avg Shot Distance** | ${avgDistance.toFixed(2)} units | ${avgDistance > 5 ? 'I was swinging for the fences' : avgDistance > 2 ? 'Moderate power, moderate results' : 'Playing it pretty safe out there'} |
| **Wall Bounces** | ${wallBounces} | ${wallBounces === 0 ? '✨ Nailed the angles! No walls!' : wallBounces <= 2 ? 'Pretty clean shooting' : 'Okay, walls and I had a moment'} |

---

## The Drama

${dramaSection}

---

## Shot-by-Shot Play-by-Play

| # | From | To | Δ | Comment |
|---|------|-----|------------|---------|
${enrichedShotHistory.map((s, i) => {
    let comment = '';
    if (s.distanceChange < -5) comment = '✨ Amazing!';
    else if (s.distanceChange < -1) comment = '👍 Good shot';
    else if (s.distanceChange < 1 && s.distanceChange > -1) comment = '🤷 Meh';
    else if (s.distanceChange > 2) comment = '😬 Oops...';
    else if (s.distanceChange > 1) comment = '⚠️ Backslide';
    
    if (s.ballBefore?.x && s.ballAfter?.x) {
        return `| ${i + 1} | (${s.ballBefore.x.toFixed(1)}, ${s.ballBefore.z.toFixed(1)}) | (${s.ballAfter.x.toFixed(1)}, ${s.ballAfter.z.toFixed(1)}) | ${s.distanceChange > 0 ? '+' : ''}${s.distanceChange?.toFixed(2) || 'N/A'} | ${comment} |`;
    } else {
        return `| ${i + 1} | ❓ | ❓ | ${s.distanceChange?.toFixed(2) || 'N/A'} | ${comment} |`;
    }
}).join('\n')}

---

## Course Info

**${courseLayout?.name || 'Mystery Course'}**  
${courseLayout?.description ? `*${courseLayout.description}*` : 'No description provided. Mysterious.'}

- 🧱 Walls: ${courseLayout?.walls?.length || 0}
- 🗻 Obstacles: ${courseLayout?.obstacles?.length || 0}  
- 📍 Playable areas: ${courseLayout?.regions?.length || 0}

---

## Narrator's Notes

This session report was generated by me, your friendly neighborhood game companion, using:
- **AI Brain:** Phi3 (local, fast, and hilariously opinionated)
- **Game:** A minigolf/billiards hybrid with personality
- **Attitude:** Cautiously optimistic
- **Soundtrack:** Whatever's playing in your head right now

*Want the raw data? Check out the JSON file. But honestly, this version is way more fun.* 😎
`;
    }


    /**
     * Generate outcome summary using Phi3
     */
    async generateOutcomeSummary(outcome, totalStrokes, sessionDuration, regressions, greatShots) {
        const prompt = `You are a sarcastic game companion. Generate ONE witty sentence (max 15 words) about this game session outcome:
Outcome: ${outcome}
Strokes: ${totalStrokes}
Duration: ${(sessionDuration / 1000).toFixed(1)}s
Great shots: ${greatShots}
Bad shots: ${regressions}

Just the sentence, no explanations.`;

        try {
            const response = await this.llmService.generate(prompt);
            return response.trim() || this.getDefaultOutcomeSummary(outcome, totalStrokes);
        } catch (e) {
            console.warn('LLM summary generation failed, using default');
            return this.getDefaultOutcomeSummary(outcome, totalStrokes);
        }
    }

    /**
     * Generate dramatic moments section using Phi3
     */
    async generateDrama(shotHistory, outcome) {
        if (shotHistory.length === 0) {
            return '**Nothing happened.** Literally. No shots. Just vibes.';
        }

        const dramaSummary = shotHistory
            .filter(s => s.distanceChange !== undefined && (Math.abs(s.distanceChange) > 2))
            .slice(0, 3)
            .map(s => {
                if (s.distanceChange < -3) return 'amazing shot that worked';
                if (s.distanceChange > 2) return 'shot that went completely wrong';
                return 'shot with unexpected results';
            })
            .join(', ');

        const prompt = `You are a sarcastic sports commentator. Generate a 2-3 sentence dramatic play-by-play of this minigolf session:
Outcome: ${outcome}
Key moments: ${dramaSummary || 'nothing special happened'}

Make it funny and brief. Keep it under 50 words.`;

        try {
            const response = await this.llmService.generate(prompt);
            return response.trim() || '**The session happened.** Things occurred. Results were achieved.';
        } catch (e) {
            console.warn('LLM drama generation failed, using default');
            return '**The session happened.** Things occurred. Results were achieved.';
        }
    }

    /**
     * Fallback outcome summary when LLM unavailable
     */
    getDefaultOutcomeSummary(outcome, totalStrokes) {
        if (outcome === 'Won' && totalStrokes <= 3) {
            return `🏃 **I crushed it!** Just ${totalStrokes} strokes. I'm calling myself a pro.`;
        } else if (outcome === 'Won' && totalStrokes <= 6) {
            return `✨ **Not bad!** ${totalStrokes} strokes and I'm happy with that.`;
        } else if (outcome === 'Won') {
            return `💪 **I persevered.** It took ${totalStrokes} strokes but I got there.`;
        } else {
            return `😅 **That didn't work out.** But hey, at least I tried!`;
        }
    }

    /**
     * Wrap text to specified width
     */
    wrapText(text, width) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + ' ' + word).length <= width) {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) lines.push(currentLine);

        return lines;
    }
}

export default ReportGenerator;
