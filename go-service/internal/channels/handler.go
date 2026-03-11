package channels

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type createChannelRequest struct {
	Name string `json:"name" binding:"required,min=2"`
	Type string `json:"type" binding:"required,oneof=open private"`
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
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "invalid invite code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := JoinChannel(c.Request.Context(), ch.ID, userID.(string)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channel": ch})
}

// GET /channels/:id/messages?limit=50
func GetMessagesHandler(c *gin.Context) {
	channelID := c.Param("id")
	userID, _ := c.Get("userID")

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
