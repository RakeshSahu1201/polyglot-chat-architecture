package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// ChannelMessage holds the schema definition for the ChannelMessage entity.
type ChannelMessage struct {
	ent.Schema
}

// Fields of the ChannelMessage.
func (ChannelMessage) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).
			Default(uuid.New),
		field.UUID("channel_id", uuid.UUID{}),
		field.UUID("user_id", uuid.UUID{}),
		field.String("user_name").
			NotEmpty(),
		field.String("body").
			Optional(),
		field.String("media_url").
			Optional().
			Nillable(),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
	}
}

// Edges of the ChannelMessage.
func (ChannelMessage) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("channel", Channel.Type).
			Ref("messages").
			Field("channel_id").
			Required().
			Unique(),
		edge.From("author", User.Type).
			Ref("channel_messages").
			Field("user_id").
			Required().
			Unique(),
	}
}
