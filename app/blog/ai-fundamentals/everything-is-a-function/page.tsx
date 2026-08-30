import PostShell, { DemoFrame, Prose } from "../post-shell";

export const metadata = {
  title: "Everything Is a Function | Tito Fleming",
  description: "Part 1 of The Fundamentals of AI: how machines see.",
};

export default function Page() {
  return (
    <PostShell part={1}>
      <Prose>
        <p>
          Neural networks are just very long functions. This post tries to show that
          instead of just saying it. I trained a small neural network on MNIST, a famous
          dataset of 70,000 handwritten digits, and put it into this page. If you draw a
          digit in the black box, the model guesses what you drew.
        </p>
      </Prose>

      <DemoFrame part={1} view="draw" height={560} />

      <Prose>
        <p>
          The part that surprised me most when I first learned this: the model never sees
          a picture. Your drawing gets shrunk down to a grid of 28 by 28 pixels, and each
          pixel becomes one number describing how bright it is. 0 means black, 1 means
          white, and decimals sit in between. That is the entire input. Your digit is now
          784 numbers.
        </p>
        <p>
          The grid below shows your drawing after that step, and if you hover over it you
          can read the actual numbers. Press the button underneath to flatten the grid
          into one long row, because that is what the model really receives: not an
          image, just a list. It never even knows which pixels were next to each other.
        </p>
      </Prose>

      <DemoFrame part={1} view="pixels" height={520} />

      <Prose>
        <p>
          Once the drawing is a list of numbers, the prediction is plain arithmetic. The
          model multiplies each of the 784 numbers by a weight, adds everything up, and
          repeats that ten times, once for each digit from 0 to 9. The biggest total
          wins. Written as math it&rsquo;s <code>f(x) = softmax(W·x + b)</code>, but
          there&rsquo;s nothing more inside: 7,840 multiplications total. You could do every one of
          them with a pencil and get the exact same answer this page gives you.
        </p>
        <p>
          So the only mystery left is the weights. I didn&rsquo;t pick them. Below are
          the ten sets of weights from my model, drawn as pictures. An
          orange pixel means ink there raises that digit&rsquo;s score, and a blue pixel
          means ink there lowers it. Squint and you can see a faint 0 in the 0 detector.
          The model is really just comparing your drawing to ten blurry stencils.
        </p>
      </Prose>

      <DemoFrame part={1} view="weights" height={260} />

      <Prose>
        <p>
          Nobody drew those stencils. They were found automatically, by an algorithm
          called gradient descent, and that is the next post.
        </p>
      </Prose>
    </PostShell>
  );
}
