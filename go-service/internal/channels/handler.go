package channels

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/polyglot-chat/go-service/ent"
	mediaapi "github.com/polyglot-chat/go-service/pkg/media"
)

type createChannelRequest struct {
	Name string `json:"name" binding:"required,min=2"`
	Type string `json:"type" binding:"required,oneof=open private"`
}

func ensureActiveChannel(c *gin.Context, channelID string) bool {
	archived, err := IsChannelArchived(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	if archived {
		c.JSON(http.StatusGone, gin.H{"error": "channel has been archived"})
		return false
	}
	return true
}

// POST /channels
func CreateChannelHandler(c *gin.Context) {
	var req createChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ownerID, _ := c.Get("userID")
	inviteCode, err := GenerateInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate invite code"})
		return
	}

	ch, err := CreateChannel(c.Request.Context(), req.Name, req.Type, inviteCode, ownerID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"channel": ch})
}

// POST /channels/join   body: { "invite_code": "..." }
func JoinChannelHandler(c *gin.Context) {
	var req struct {
		InviteCode string `json:"invite_code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("userID")

	ch, err := GetChannelByInviteCode(c.Request.Context(), req.InviteCode)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "invalid invite code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	status := "approved"
	if ch.Type == "private" {
		status = "pending"
	}

	if err := JoinChannel(c.Request.Context(), ch.ID, userID.(string), status); err != nil {
		if strings.Contains(err.Error(), "archived") {
			c.JSON(http.StatusGone, gin.H{"error": "channel has been archived"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"channel": ch,
		"status":  status,
	})
}

// GET /channels/:id/messages?limit=50
func GetMessagesHandler(c *gin.Context) {
	channelID := c.Param("id")
	userID, _ := c.Get("userID")

	if !ensureActiveChannel(c, channelID) {
		return
	}

	ok, err := IsMember(c.Request.Context(), channelID, userID.(string))
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this channel"})
		return
	}

	msgs, err := GetMessages(c.Request.Context(), channelID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": msgs})
}

// POST /channels/:id/media
func UploadMediaHandler(c *gin.Context) {
	channelID := c.Param("id")
	userID, _ := c.Get("userID")

	if !ensureActiveChannel(c, channelID) {
		return
	}

	ok, err := IsMember(c.Request.Context(), channelID, userID.(string))
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this channel"})
		return
	}

	file, err := c.FormFile("media")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "media file is required"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open media file"})
		return
	}
	defer src.Close()

	asset, err := mediaapi.Upload(c.Request.Context(), mediaapi.UploadParams{
		AuthHeader: c.GetHeader("Authorization"),
		FileName:   file.Filename,
		Reader:     src,
		Fields: map[string]string{
			"kind":      "channel-message",
			"channelId": channelID,
		},
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, asset)
}

// GET /channels  — list channels the current user has joined
func ListUserChannelsHandler(c *gin.Context) {
	userID, _ := c.Get("userID")

	channels, err := GetUserChannels(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

// POST /channels/:id/members  body: { "user_id": "<uuid>" }
// Only the channel owner can add members (used for private channels).
func AddMemberHandler(c *gin.Context) {
	channelID := c.Param("id")
	requesterID, _ := c.Get("userID")

	if !ensureActiveChannel(c, channelID) {
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := GetChannelByID(c.Request.Context(), channelID)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Only the owner can add members
	if ch.OwnerID != requesterID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the channel owner can add members"})
		return
	}

	if err := JoinChannel(c.Request.Context(), channelID, req.UserID, "approved"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member added"})
}

// GET /channels/:id  — returns channel info and member count
func GetChannelInfoHandler(c *gin.Context) {
	channelID := c.Param("id")
	userID, _ := c.Get("userID")

	if !ensureActiveChannel(c, channelID) {
		return
	}

	// Check membership
	ok, err := IsMember(c.Request.Context(), channelID, userID.(string))
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	info, err := GetChannelWithMemberCount(c.Request.Context(), channelID)
	if err != nil {
		if ent.IsNotFound(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channel": info})
}

// PUT /channels/:id  body: { "name": "new-name" } — owner-only rename
func RenameChannelHandler(c *gin.Context) {
	channelID := c.Param("id")
	owned, _ := c.Get("userID")

	if !ensureActiveChannel(c, channelID) {
		return
	}

	var req struct {
		Name string `json:"name" binding:"required,min=2"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch, err := GetChannelByID(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if ch.OwnerID != owned.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the channel owner can rename"})
		return
	}

	updated, err := RenameChannel(c.Request.Context(), channelID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channel": updated})
}

// GET /channels/:id/members  — lists members of a channel
func GetChannelMembersHandler(c *gin.Context) {
	channelID := c.Param("id")
	userID, _ := c.Get("userID")

	if !ensureActiveChannel(c, channelID) {
		return
	}

	ok, err := IsMember(c.Request.Context(), channelID, userID.(string))
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member"})
		return
	}

	members, err := GetChannelMembers(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

// POST /channels/members/:membershipId/approve — owner-only
func ApproveMemberHandler(c *gin.Context) {
	membershipID := c.Param("membershipId")
	requesterID, _ := c.Get("userID")

	// Get membership to find channel
	member, err := GetMembershipByID(c.Request.Context(), membershipID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "membership not found"})
		return
	}

	// Get channel to verify owner
	ch, err := GetChannelByID(c.Request.Context(), member.ChannelID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "channel not found"})
		return
	}
	if ch.Archived {
		c.JSON(http.StatusGone, gin.H{"error": "channel has been archived"})
		return
	}

	if ch.OwnerID != requesterID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the owner can approve members"})
		return
	}

	if err := ApproveMember(c.Request.Context(), membershipID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "approved"})
}

// DELETE /channels/members/:membershipId — owner-only (reject/kick)
func RemoveMemberHandler(c *gin.Context) {
	membershipID := c.Param("membershipId")
	requesterID, _ := c.Get("userID")

	member, err := GetMembershipByID(c.Request.Context(), membershipID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "membership not found"})
		return
	}

	ch, err := GetChannelByID(c.Request.Context(), member.ChannelID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "channel not found"})
		return
	}
	if ch.Archived {
		c.JSON(http.StatusGone, gin.H{"error": "channel has been archived"})
		return
	}

	// Only owner can remove others; users can remove themselves (leave)
	if ch.OwnerID != requesterID.(string) && member.UserID.String() != requesterID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the owner can remove members"})
		return
	}

	if err := RemoveMember(c.Request.Context(), membershipID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "removed"})
}
