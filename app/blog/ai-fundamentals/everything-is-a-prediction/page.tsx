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
          A language model has one job, given the current context guess what word comes
          next. That is the core feature behind ChatGPT, and it is also the trick behind
          the autocomplete strip on your phone&rsquo;s keyboard. To show how it works, I
          built the small one below. It learned everything it knows from just one book,
          Alice in Wonderland, and you can write with it by tapping/clicking on the
          suggestion chips.
        </p>
      </Prose>

      <DemoFrame part={3} />

      <Prose>
        <p>
          The most important feature here is the memory slider. It controls how many
          previous words the model looks at when guessing the next one. At 0 it looks at
          nothing and just picks whatever words are most common. At 1 it only looks at
          the last word, which is close to what your phone&rsquo;s autocomplete does. At
          2 it looks at the last two words, and with just that it starts to sound like
          the book it learned from.
        </p>
        <p>
          Set the slider to 10 and the suggestions stop coming. This model works by
          searching its training text for your exact last words, and one book is nowhere
          near enough text to contain every possible 10 word phrase. After a few words,
          whatever you wrote has probably never appeared in the book at all, so there is
          nothing to find.
        </p>
        <p>
          ChatGPT looks at hundreds of thousands of words at once, and as we just saw,
          searching stored text stops working long before that. So instead of searching,
          it uses a function that takes the words in and outputs a probability for every
          possible next word. That is the same kind of function from part 1, and it gets
          trained with gradient descent from part 2. A function does not need to have
          seen your exact sentence before to handle it. That ability is called
          generalization, and it&rsquo;s the reason neural networks replaced lookup
          tables.
        </p>
      </Prose>
    </PostShell>
  );
}
