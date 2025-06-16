const Event = require('../models/event');
const Club =require('../models/clubs');
const User=require('../models/user')
exports.createEvent = async (req, res) => {
  const { clubId,
      title,
      date,
      time,
      location,
      description} = req.body;
  console.log(req.body);
   const club=clubId
  try {
    const newEvent = new Event({
      club,
      title,
      date,
      time,
      location,
      description,
      attendees:  0 
    });

    await newEvent.save();

    res.status(201).json({ success: true, message: "Event created successfully", event: newEvent });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, message: "Error creating event" });
  }
};
exports.getEventsByClubId = async (req, res) => {
    try {
        const { clubId } = req.params;
        const club = await Club.findById(clubId);
        const events = await Event.find({ club: club._id }); 
        if (events.length === 0) {
            return res.status(404).json({ message: 'No events found for this club' });
        }
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEvents = async (req, res) => {
  try {
          const events = await Event.find();  
          res.status(200).json({ success: true, events});
        } catch (error) {
          console.error("Error fetching error:", error);
          res.status(500).json({ success: false, message: "Error fetching error" });
        }
};
exports.registerEvent=async(req,res)=>{
  const { eventId } = req.params; 
  const { name } = req.body; 

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.RegisteredEvents.includes(eventId)) {
      return res.status(400).json({ message: "User already registered for this event" });
    }
    user.RegisteredEvents.push(eventId);
    event.attendees+=1;
    await event.save();
    await user.save(); 
    console.log(user.RegisteredEvents)
    return res.status(200).json({
      message: "Successfully registered for the event",
      user,
      RegisteredEvents: user.RegisteredEvents, 
    });
  } catch (error) {
    console.error("Error in handleRegister:", error);
    return res.status(500).json({
      message: "An error occurred during registration",
      error: error.message,
    });
  }
}