# Decode FormData

When the values of your form are encoded to `FormData`, for example to send them to a server via HTTP, some information is lost. Using this library, you can decode `FormData` into a JavaScript object and supplement the information that was lost during encoding.

This library is especially useful in combination with progressively enhanced forms via actions in fullstack frameworks such as [Next.js](https://nextjs.org/), [Nuxt](https://nuxt.com/), [Remix](https://remix.run/), [SvelteKit](https://kit.svelte.dev/), [SolidStart](https://start.solidjs.com/), and [Qwik](https://qwik.builder.io/). Furthermore, you can validate and type the decoded data afterwards with a schema library like [Valibot](https://valibot.dev/) or [Zod](https://zod.dev/).

## Installation

This library is available for Node, Bun and Deno.

### npm

```bash
npm install decode-formdata   # npm
yarn add decode-formdata      # yarn
pnpm add decode-formdata      # pnpm
bun add decode-formdata       # bun
```

```ts
import { decode } from 'decode-formdata';
```

### Deno

```ts
import { decode } from 'https://deno.land/x/decode_formdata/mod.ts';
```

## How it works

`FormData` stores the names of your fields and their values. However, there is a problem. Only strings and files are accepted as values, but complex forms can contain booleans, strings and dates. This leads to the fact that the boolean value `true` must be mapped with `"on"` and `false` values are simply ignored. Numbers and dates are also converted to strings.

Another problem are objects and arrays, which are usually mapped using dot and bracket notation. For example, the input field `<input name="todos.0.label" />` should map to the object `{ todos: [{ label: "" }] }`. By telling `decode` where arrays, booleans, dates, files, and numbers are located, the function can decode your `FormData` back into a complex JavaScript object.

> Both dot and bracket notation are supported for arrays.

Consider the following form to add a new product to an online store:

```html
<form enctype="multipart/form-data" method="post">
  <!-- Product -->
  <input name="title" type="text" />
  <input name="price" type="number" />

  <!-- Metadata -->
  <input name="created" type="date" />
  <input name="active" type="checkbox" />

  <!-- Tags -->
  <input name="tags.0" type="text" />
  <input name="tags.1" type="text" />
  <input name="tags.2" type="text" />

  <!-- Images -->
  <input name="images.0.title" type="text" />
  <input name="images.0.created" type="date" />
  <input name="images.0.file" type="file" />
  <input name="images.1.title" type="text" />
  <input name="images.1.created" type="date" />
  <input name="images.1.file" type="file" />
</form>
```

When the form is submitted to the server, the `FormData` may contain the following entries:

```ts
const formEntries = [
  ['title', 'Red apple'],
  ['price', '0.89'],
  ['created', '2023-10-09'],
  ['active', 'on'],
  ['tags.0', 'fruit'],
  ['tags.1', 'healthy'],
  ['tags.2', 'sweet'],
  ['images.0.title', 'Close up of an apple'],
  ['images.0.created', '2023-08-24'],
  ['images.0.file', Blob],
  ['images.1.title', 'Our fruit fields at Lake Constance'],
  ['images.1.created', '2023-08-12'],
  ['images.1.file', Blob],
];
```

Using `decode` of this library you can easily decode this data back to JavaScript:

```ts
import { decode } from 'decode-formdata';

async function server(formData: FormData) {
  const formValues = decode(formData, {
    arrays: ['tags', 'images'],
    booleans: ['active'],
    dates: ['created', 'images.$.created'],
    files: ['images.$.file'],
    numbers: ['price'],
  });
}
```

> For deeply nested arrays, use the `$` symbol instead of the index when specifying the path to a specifiy data type.

After decoding, `formValues` now contains the following data:

```ts
const formValues = {
  title: 'Red apple',
  price: 0.89,
  created: Date,
  active: true,
  tags: ['fruit', 'healthy', 'sweet'],
  images: [
    {
      title: 'Close up of an apple',
      created: Date,
      file: Blob,
    },
    {
      title: 'Our fruit fields at Lake Constance',
      created: Date,
      file: Blob,
    },
  ],
};
```

## Validation

Now, to validate and type your form's data, you can use a schema library like [Valibot](https://valibot.dev/) or [Zod](https://zod.dev/).

```ts
import { decode } from 'decode-formdata';
import * as v from 'valibot';

// Create product schema
const ProductSchema = v.object({
  title: v.string(),
  price: v.number(),
  created: v.date(),
  active: v.boolean(),
  tags: v.array(v.string()),
  images: v.array(
    v.object({
      title: v.string(),
      created: v.date(),
      file: v.blob(),
    })
  ),
});

async function server(formData: FormData) {
  try {
    // Decode form date
    const formValues = decode(formData, {
      arrays: ['tags', 'images'],
      booleans: ['active'],
      dates: ['created', 'images.$.created'],
      files: ['images.$.file'],
      numbers: ['price'],
    });

    // Parse form values
    const productData = v.parse(ProductSchema, formValues);

    // Handle errors
  } catch (error) {
    // ...
  }
}
```

## Feedback

Find a bug or have an idea how to improve the library? Please fill out an [issue](https://github.com/fabian-hiller/decode-formdata/issues/new). Together we can make the library even better!

## License

This project is available free of charge and licensed under the [MIT license](https://github.com/fabian-hiller/decode-formdata/blob/main/LICENSE.md).

## Note

Both dot and bracket notation are supported for arrays.
