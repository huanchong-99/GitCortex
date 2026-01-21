use axum::{
    Router,
    extract::{Json, Path, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{delete, get, patch, post},
};
use utils::{
    api::{
        organizations::{
            AcceptInvitationResponse, CreateInvitationRequest, CreateInvitationResponse,
            CreateOrganizationRequest, CreateOrganizationResponse, GetInvitationResponse,
            GetOrganizationResponse, ListInvitationsResponse, ListMembersResponse,
            ListOrganizationsResponse, Organization, RevokeInvitationRequest,
            UpdateMemberRoleRequest, UpdateMemberRoleResponse, UpdateOrganizationRequest,
        },
        projects::RemoteProject,
    },
    response::ApiResponse,
};
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/organizations", get(list_organizations))
        .route("/organizations", post(create_organization))
        .route("/organizations/{id}", get(get_organization))
        .route("/organizations/{id}", patch(update_organization))
        .route("/organizations/{id}", delete(delete_organization))
        .route(
            "/organizations/{org_id}/projects",
            get(list_organization_projects),
        )
        .route(
            "/organizations/{org_id}/invitations",
            post(create_invitation),
        )
        .route("/organizations/{org_id}/invitations", get(list_invitations))
        .route(
            "/organizations/{org_id}/invitations/revoke",
            post(revoke_invitation),
        )
        .route("/invitations/{token}", get(get_invitation))
        .route("/invitations/{token}/accept", post(accept_invitation))
        .route("/organizations/{org_id}/members", get(list_members))
        .route(
            "/organizations/{org_id}/members/{user_id}",
            delete(remove_member),
        )
        .route(
            "/organizations/{org_id}/members/{user_id}/role",
            patch(update_member_role),
        )
}

async fn list_organization_projects(
    State(_deployment): State<DeploymentImpl>,
    Path(_org_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<RemoteProject>>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn list_organizations(
    State(_deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<ListOrganizationsResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn get_organization(
    State(_deployment): State<DeploymentImpl>,
    Path(_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<GetOrganizationResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn create_organization(
    State(_deployment): State<DeploymentImpl>,
    Json(_request): Json<CreateOrganizationRequest>,
) -> Result<ResponseJson<ApiResponse<CreateOrganizationResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn update_organization(
    State(_deployment): State<DeploymentImpl>,
    Path(_id): Path<Uuid>,
    Json(_request): Json<UpdateOrganizationRequest>,
) -> Result<ResponseJson<ApiResponse<Organization>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn delete_organization(
    State(_deployment): State<DeploymentImpl>,
    Path(_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn create_invitation(
    State(_deployment): State<DeploymentImpl>,
    Path(_org_id): Path<Uuid>,
    Json(_request): Json<CreateInvitationRequest>,
) -> Result<ResponseJson<ApiResponse<CreateInvitationResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn list_invitations(
    State(_deployment): State<DeploymentImpl>,
    Path(_org_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<ListInvitationsResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn get_invitation(
    State(_deployment): State<DeploymentImpl>,
    Path(_token): Path<String>,
) -> Result<ResponseJson<ApiResponse<GetInvitationResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn revoke_invitation(
    State(_deployment): State<DeploymentImpl>,
    Path(_org_id): Path<Uuid>,
    Json(_payload): Json<RevokeInvitationRequest>,
) -> Result<StatusCode, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn accept_invitation(
    State(_deployment): State<DeploymentImpl>,
    Path(_invitation_token): Path<String>,
) -> Result<ResponseJson<ApiResponse<AcceptInvitationResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn list_members(
    State(_deployment): State<DeploymentImpl>,
    Path(_org_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<ListMembersResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn remove_member(
    State(_deployment): State<DeploymentImpl>,
    Path((_org_id, _user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}

async fn update_member_role(
    State(_deployment): State<DeploymentImpl>,
    Path((_org_id, _user_id)): Path<(Uuid, Uuid)>,
    Json(_request): Json<UpdateMemberRoleRequest>,
) -> Result<ResponseJson<ApiResponse<UpdateMemberRoleResponse>>, ApiError> {
    Err(ApiError::BadRequest(
        "Remote organization features are not supported in this version.".to_string(),
    ))
}
