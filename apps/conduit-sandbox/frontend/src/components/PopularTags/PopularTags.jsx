import { useEffect, useState } from "react";
import getTags from "../../services/getTags";
import TagButton from "./TagButton";

function PopularTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    getTags()
      .then(setTags)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <aside className="col-md-3">
      <div className="sidebar">
        <h6>热门标签</h6>
        <div className="tag-list">
          {tags.length > 0 ? (
            <TagButton tagsList={tags} />
          ) : loading ? (
            <p>正在加载标签...</p>
          ) : (
            <p>暂无标签。</p>
          )}
        </div>
      </div>
    </aside>
  );
}

export default PopularTags;
