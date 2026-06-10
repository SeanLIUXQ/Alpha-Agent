export default function dateFormatter(date) {
  return new Date(date).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
