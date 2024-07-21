export function validatePartyTitle(title: string) {
  title = title.trim();

  if (!title) {
    return "Title is required";
  }

  if (title.length > 50) {
    return "Title must be less than 50 characters";
  }

  return null;
}

export function validatePartyDescription(description: string) {
  description = description.trim();

  if (description.length > 500) {
    return "Description must be less than 500 characters";
  }

  return null;
}

export function validatePartyParticipantName(name: string) {
  name = name.trim();

  if (!name) {
    return "A name for the participant is required";
  }

  if (name.length > 50) {
    return "Name must be less than 50 characters";
  }

  return null;
}
