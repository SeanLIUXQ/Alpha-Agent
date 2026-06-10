import avatar from "../../assets/smiley-cyrus.jpeg";

function Avatar({ alt, className, src }) {
  return (
    <img
      alt={alt || "默认头像"}
      className={className || ""}
      src={src || avatar}
      onError={(event) => {
        if (event.currentTarget.src !== avatar) {
          event.currentTarget.src = avatar;
        }
      }}
    />
  );
}

export default Avatar;
