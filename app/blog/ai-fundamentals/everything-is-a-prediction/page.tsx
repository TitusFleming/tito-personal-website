import PostShell, { DemoFrame, Prose } from "../post-shell";

export const metadata = {
  title: "Everything Is a Prediction | Tito Fleming",
  description: "Part 3 of The Fundamentals of AI: from digits to language.",
};

export default function Page() {
  return (
    <PostShell part={3}>
      <Prose>
        <p>
          A language model has one job: given some text, put a probability on every word
          that could come next. That is the trick behind ChatGPT, and it is also the
          trick behind the autocomplete strip on your phone keyboard. To show how it
          works, I built the small one below. It learned everything it knows from a
          single book, Alice in Wonderland, and you can write with it by tapping the
          suggestion chips.
        </p>
      </Prose>

      <DemoFrame part={3} />

      <Prose>
        <p>
          The control that matters is the memory slider. At 0 words of memory the model
          picks words purely by how common they are, and the result is soup. Give it 1
          word of memory and grammar starts to appear, which is roughly what your phone
          keyboard does. At 2 words it suddenly sounds like Lewis Carroll, because pairs
          of Carroll&rsquo;s words are exactly what it counted.
        </p>
        <p>
          Now slide it to 10 and everything dies. The model works by looking up your
          exact last words in a table of counts, and a table covering every possible 10
          word phrase would need more rows than there are atoms in the universe. One book
          fills basically none of them. Almost any 10 word sentence you type has never
          been written before by anyone, so there is nothing to look up.
        </p>
        <p>
          This is the problem that forces the jump to neural networks. Replace the lookup
          table with a function that takes the text and outputs the probabilities, which
          is part 1 with words instead of pixels. Train that function with gradient
          descent on how surprised it was by each real next word, which is part 2 with
          around a trillion weights instead of two.
        </p>
        <p>
          Early in training, the function mostly memorizes the text it has seen. Keep
          training and something better happens: it starts working on text it has never
          seen, because the patterns it was forced to learn, grammar, style, the way
          ideas follow each other, apply to sentences that were never in the training
          data at all. That is called generalization, and it is the one thing a lookup
          table can never do.
        </p>
      </Prose>
    </PostShell>
  );
}
