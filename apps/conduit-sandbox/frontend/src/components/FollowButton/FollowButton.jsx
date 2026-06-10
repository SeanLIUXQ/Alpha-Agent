import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import toggleFollow from "../../services/toggleFollow";

function FollowButton({ followersCount, following, handler, username }) {
  const [loading, setLoading] = useState(false);
  const { headers, isAuth } = useAuth();

  const buttonStyle = following ? "btn-secondary" : "";
  const iconStyle = following ? "ion-minus-round" : "ion-plus-round";
  const text = !isAuth ? "关注者" : following ? " 取消关注 " : " 关注 ";

  const handleClick = () => {
    if (!isAuth) return alert("请先登录");

    setLoading(true);

    toggleFollow({ following, headers, username })
      .then(handler)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  return (
    <>
      <button
        className={`btn btn-sm action-btn ${buttonStyle}`}
        disabled={loading}
        onClick={handleClick}
        style={{ color: "#777" }}
      >
        {isAuth && <i className={iconStyle}></i>} {text} {isAuth && username}
        <span className="counter"> ( {followersCount} )</span>
      </button>{" "}
    </>
  );
}

export default FollowButton;
