export type BlogPost = {
  part: number;
  slug: string;
  title: string;
  meta: string;
  blurb: string;
  status: "draft" | "published";
};

export const BLOG_SERIES = {
  title: "The Fundamentals of AI",
  tagline:
    "This stuff isn't complicated, the explanations just made it feel that way. So I built ones you can play with instead.",
  posts: [
    {
      part: 1,
      slug: "everything-is-a-function",
      title: "Everything Is a Function",
      meta: "Part 1 · How machines see",
      blurb:
        "The machine that reads your handwriting has never seen anything. It's arithmetic. Draw a digit and watch it work.",
      status: "draft",
    },
    {
      part: 2,
      slug: "how-machines-learn",
      title: "How Machines Learn",
      meta: "Part 2 · Gradient descent",
      blurb:
        "You are a marble in thick fog with one rule: roll downhill. Get stuck in the wrong valley, then shake your way out.",
      status: "draft",
    },
    {
      part: 3,
      slug: "everything-is-a-prediction",
      title: "Everything Is a Prediction",
      meta: "Part 3 · From digits to language",
      blurb:
        "Your phone's autocomplete and ChatGPT are the same species. The difference is one slider. Drag it and watch counting die.",
      status: "draft",
    },
  ] satisfies BlogPost[],
};
