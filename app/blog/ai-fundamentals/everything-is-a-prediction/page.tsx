import PostShell, { Bubble, DemoFrame } from "../post-shell";

export const metadata = {
  title: "Everything Is a Prediction | Tito Fleming",
  description: "Part 3 of The Fundamentals of AI: from digits to language.",
};

export default function Page() {
  return (
    <PostShell part={3}>
      <Bubble kicker="the setup">
        <p>
          A language model has basically one job: given the current context, assign a
          probability to every possible next word. The model below was trained on the
          text of a single book and nothing else. Write a sentence using the suggestion
          chips.
        </p>
      </Bubble>

      <DemoFrame part={3} />

      <Bubble kicker="one job">
        <p>
          Your phone&rsquo;s suggestion strip and ChatGPT are the same kind of machine.
          Neither knows anything, and neither means anything. Both predict the next word,
          then the next. The difference between them comes down to one slider.
        </p>
      </Bubble>

      <Bubble kicker="memory buys quality">
        <p>
          At 0 words of memory, words are chosen by raw popularity. At 1, grammar
          appears, which is roughly a phone keyboard. At 2, the model writes recognizable
          Carroll, because Carroll&rsquo;s word pairs are what it counted.
        </p>
        <p>Each notch of memory buys better prediction.</p>
      </Bubble>

      <Bubble kicker="where counting dies">
        <p>
          At 10, the suggestions go dark. A ten word memory requires a counting table
          with more rows than there are atoms in the universe, and one book fills none of
          them. Nearly every ten word sentence ever typed is new in the history of
          English. There is nothing to count.
        </p>
      </Bubble>

      <Bubble kicker="the table becomes a function">
        <p>
          The only way forward is to replace the table with a function that outputs the
          probabilities: part 1, with words in place of pixels. The function is tuned by
          rolling downhill on its surprise at the real next word: part 2, with a trillion
          weights in place of two.
        </p>
        <p>
          Early in training, the function mostly memorizes the data it has seen. Keep
          training and something better happens: it starts working on data it has never
          seen, because the patterns it was forced to learn, grammar, style, how ideas
          connect, apply to sentences that were never in the training data at all. That
          is called generalization, and it is the one thing a table can never do.
        </p>
      </Bubble>
    </PostShell>
  );
}
