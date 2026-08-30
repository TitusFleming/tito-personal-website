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
    "I think these ideas are much easier to understand visually than by reading about them. Each post here pairs a short explanation with something you can play with.",
  posts: [
    {
      part: 1,
      slug: "everything-is-a-function",
      title: "Everything Is a Function",
      meta: "Part 1 · How machines see",
      blurb:
        "The model that reads your handwriting cant actually see, it's just a mathematical function. Draw a digit and it will guess what you wrote.",
      status: "draft",
    },
    {
      part: 2,
      slug: "how-machines-learn",
      title: "How Machines Learn",
      meta: "Part 2 · Gradient descent",
      blurb:
        "Gradient descent sounds scary but it's just a ball rolling downhill. Drop one, watch it get stuck in the wrong valley, and shake it out.",
      status: "draft",
    },
    {
      part: 3,
      slug: "everything-is-a-prediction",
      title: "Everything Is a Prediction",
      meta: "Part 3 · From digits to language",
      blurb:
        "Your phone's autocomplete and ChatGPT do the same job. I built a tiny one from a single book, and a slider shows what changes at scale.",
      status: "draft",
    },
  ] satisfies BlogPost[],
};
