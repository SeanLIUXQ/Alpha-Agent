import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import postComment from "../../services/postComment";
import Avatar from "../Avatar";

function CommentEditor({ updateComments }) {
  const [{ body }, setForm] = useState({ body: "" });
  const { headers, isAuth, loggedUser } = useAuth();
  const { username, image } = loggedUser || {};
  const { slug } = useParams();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (body.trim() === "") return;

    postComment({ body, headers, slug })
      .then(updateComments)
      .then(setForm({ body: "" }))
      .catch(console.error);
  };

  const handleChange = (e) => {
    setForm({ body: e.target.value });
  };

  return isAuth ? (
    <form className="card comment-form" onSubmit={handleSubmit}>
      <div className="card-block">
        <textarea
          className="form-control"
          onChange={handleChange}
          placeholder="写下你的评论..."
          rows="3"
          value={body}
        ></textarea>
      </div>

      <div className="card-footer">
        <Avatar alt={username} className="comment-author-img" src={image} />
        <button className="btn btn-sm btn-primary">发布评论</button>
      </div>
    </form>
  ) : (
    <span>
      <Link to="/login">登录</Link> 或 <Link to="/register">注册</Link> 后参与评论。
    </span>
  );
}

export default CommentEditor;
