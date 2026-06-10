import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import dateFormatter from "../../helpers/dateFormatter";
import deleteComment from "../../services/deleteComment";
import getComments from "../../services/getComments";
import CommentAuthor from "./CommentAuthor";

function CommentList({ triggerUpdate, updateComments }) {
  const [comments, setComments] = useState([]);
  const { headers, isAuth, loggedUser } = useAuth();
  const { slug } = useParams();

  useEffect(() => {
    getComments({ slug }).then(setComments).catch(console.error);
  }, [slug, triggerUpdate]);

  const handleClick = (commentId) => {
    if (!isAuth) alert("请先登录");

    const confirmation = window.confirm("确定要删除这条评论吗？");
    if (!confirmation) return;

    deleteComment({ commentId, headers, slug })
      .then(updateComments)
      .catch(console.error);
  };

  return comments?.length > 0 ? (
    comments.map(({ author, author: { username }, body, createdAt, id }) => {
      return (
        <div className="card" key={id}>
          <div className="card-block">
            <p className="card-text">{body}</p>
          </div>
          <div className="card-footer">
            <CommentAuthor {...author} />
            <span className="date-posted">{dateFormatter(createdAt)}</span>
            {isAuth && loggedUser.username === username && (
              <button
                className="btn btn-sm btn-outline-secondary pull-xs-right"
                onClick={() => handleClick(id)}
              >
                <i className="ion-trash-a"></i>
              </button>
            )}
          </div>
        </div>
      );
    })
  ) : (
    <div>还没有评论。</div>
  );
}

export default CommentList;
