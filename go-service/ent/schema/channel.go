package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// Channel holds the schema definition for the Channel entity.
type Channel struct {
	ent.Schema
}

// Fields of the Channel.
func (Channel) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New),
		field.String("name").
			NotEmpty(),
		field.String("type").
			Default("open"),
		field.String("invite_code").
			Unique().
			NotEmpty(),
		field.UUID("owner_id", uuid.UUID{}),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the Channel.
func (Channel) Edges() []ent.Edge {
	return []ent.Edge{
		// Owner user
		edge.From("owner", User.Type).
			Ref("owned_channels").
			Field("owner_id").
			Required().
			Unique(),
		// Members via ChannelMember
		edge.To("memberships", ChannelMember.Type),
		// Messages
		edge.To("messages", ChannelMessage.Type),
	}
}
