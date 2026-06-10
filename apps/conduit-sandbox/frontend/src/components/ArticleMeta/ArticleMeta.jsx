import { Link } from "react-router-dom";
import dateFormatter from "../../helpers/dateFormatter";
import Avatar from "../Avatar";

function ArticleMeta({ author, children, createdAt }) {
  const { bio, followersCount, following, image, username } = author || {};
  const profileState = { bio, followersCount, following, image, username };
  const displayName = username || "匿名作者";
  const displayBio = bio || "这位作者还没有填写简介。";
  const followerTotal = Number.isFinite(Number(followersCount)) ? Number(followersCount) : 0;

  return (
    <div className="article-meta article-meta-with-hover-card">
      <div className="article-author-hover-trigger">
        <Link
          aria-label={`查看 ${displayName} 的主页`}
          state={profileState}
          to={`/profile/${username}`}
        >
          <Avatar alt={displayName} src={image} />
        </Link>
        <div className="info">
          <Link
            className="author"
            state={profileState}
            to={`/profile/${username}`}
          >
            {displayName}
          </Link>
          <span className="date">{dateFormatter(createdAt)}</span>
        </div>
        <div className="article-author-hover-card" role="tooltip">
          <div className="article-author-hover-card-header">
            <Avatar alt={displayName} src={image} />
            <div>
              <strong>{displayName}</strong>
              <span>{followerTotal} 位粉丝</span>
            </div>
          </div>
          <p>{displayBio}</p>
          <Link className="article-author-hover-card-link" state={profileState} to={`/profile/${username}`}>
            查看主页
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

export default ArticleMeta;
