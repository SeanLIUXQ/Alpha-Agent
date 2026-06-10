import { Outlet, useLocation, useParams } from "react-router-dom";
import AuthorInfo from "../../components/AuthorInfo";
import ContainerRow from "../../components/ContainerRow";
import NavItem from "../../components/NavItem";
import { useAuth } from "../../context/AuthContext";

function Profile() {
  const { state } = useLocation();
  const { username: routeUsername } = useParams();
  const { isAuth, loggedUser } = useAuth();
  const username = state?.username ?? state?.profile?.username ?? routeUsername;
  const canSeeDrafts = isAuth && loggedUser?.username && loggedUser.username === username;

  return (
    <div className="profile-page">
      <div className="user-info">
        <ContainerRow>
          <AuthorInfo />
        </ContainerRow>
      </div>

      <ContainerRow>
        <div className="col-xs-12 col-md-10 offset-md-1">
          <div className="articles-toggle">
            <ul className="nav nav-pills outline-active">
              <NavItem text="我的文章" url="" state={state} />
              <NavItem text="收藏的文章" url="favorites" state={state} />
              {canSeeDrafts && <NavItem text="草稿" url="drafts" state={state} />}
            </ul>
          </div>
          <Outlet />
        </div>
      </ContainerRow>
    </div>
  );
}

export default Profile;
