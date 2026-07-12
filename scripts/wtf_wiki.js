import wikipediaModule from "wikipedia";

const wiki = wikipediaModule.default ?? wikipediaModule;
const query = "Centaurus A";


try {
  const searchResults = await wiki.search(query, { limit: 1 });
  const title = searchResults.results[0]?.title || query;
  const summary = await wiki.summary(title);

  let imageUrl = summary.originalimage?.source || summary.thumbnail?.source;

  if (!imageUrl) {
    const images = await wiki.images(title, { limit: 10 });
    imageUrl = images.find(image => image.url)?.url;
  }

  if (!imageUrl) {
    console.error(`No image URL found for "${title}".`);
    process.exitCode = 1;
  } else {
    console.log(imageUrl);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}