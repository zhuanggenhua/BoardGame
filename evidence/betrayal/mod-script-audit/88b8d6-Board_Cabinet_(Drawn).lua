local ConcealedStorageHeight = 3.0
local ConceiledStorageOffset = 10000.0
local StorageState = 1
local ObjectLockStates = {}

local BB = {
	Min = {
		x = -16.0,
		y = 41.99,
		z = -50.0
	},
	Max = {
		x = 16.0,
		y = 41.99,
		z = -32.0
	}
}

function onSave()
    local saveObj = {};
	
    for k,v in pairs( ObjectLockStates ) do
        if v ~= nil then
			saveObj[k] = v;
        end
    end
	
    return JSON.encode( saveObj );
end

function onLoad( saveData )
    self.interactable = false;
	
	if saveData ~= "" then
		ObjectLockStates = JSON.decode( saveData ) or {};
	end
	
    self.createButton({
		label = "",
		click_function = "onButtonClick",
		function_owner = self,
		width = 1000,
		height = 750,
		color = {1, 0, 0, 0.0},
		position = {0, 40.7, 50.5},
		rotation = {-90, 0, 0},
		font_size = 200
    })
	
	if self.getStateId() ~= StorageState then
		Timer.create({
			identifier = ("onAfterLoad" .. self.guid),
			function_name = "onAfterLoad",
			delay = 0.2
		})
	end
end

function onAfterLoad()
	local pos = self.getPosition()
	local bounds = self.getBoundsNormalized()
	local rot = self.getRotation()
	local direction = 1.0
	
	if rot.y == 0 then
		direction = -1.0
	end
	
	BB.Min.x = BB.Min.x + pos.x
	BB.Min.y = BB.Min.y + pos.y - 1.5
	BB.Min.z = (BB.Min.z * direction) + pos.z
	
	BB.Max.x = 	BB.Max.x + pos.x
	BB.Max.y = 	BB.Max.y + pos.y + ConcealedStorageHeight + 0.5
	BB.Max.z = (BB.Max.z * direction) + pos.z
	
	HideObjectsAbove( false )
end

function onButtonClick()
	local currentState = self.getStateId()
	local nextState = 1 + (currentState % 2)
	
	if currentState ~= StorageState then
		HideObjectsAbove( true )
	end
	
	self.script_state = onSave()
	self.setState( nextState )
end

function HideObjectsAbove( toggle )
    local objectsAbove = {}
	local BBMin = { x = BB.Min.x, y = BB.Min.y, z = BB.Min.z }
	local BBMax = { x = BB.Max.x, y = BB.Max.y, z = BB.Max.z }
	
	if not toggle then
		BBMin.y = BBMin.y - ConceiledStorageOffset
		BBMax.y = BBMax.y - ConceiledStorageOffset
	end
    
    for k,v in pairs( getAllObjects() ) do
        if v != self then
            if PointToAABBIntersect( BBMin, BBMax, v.getPosition() ) then
                if toggle then
                    Store( v )
                else
                    Dispense( v )
                end
            end
        end
    end
end

-- Assumes ||min|| < ||max||
function PointToAABBIntersect( min, max, point )
    if IsInRange( point.x, min.x, max.x ) and
       IsInRange( point.y, min.y, max.y ) and
       IsInRange( point.z, min.z, max.z ) then
	   return true
    end
    
    return false
end

function IsInRange( value, a, b )
	local min = 0
	local max = 0
	
	if a > b then
		max = a
		min = b
	else
		max = b
		min = a
	end
	
	if value > min and value < max then
		return true
	end
	
	return false
end

function Store( obj )
	local pos = obj.getPosition()
	local isLocked = obj.getLock()
	
	ObjectLockStates[obj.getGUID()] = isLocked;
	
    obj.interactable = false
    obj.setLock( true )
    obj.setPosition({
        x = pos.x,
        y = pos.y - ConceiledStorageOffset,
        z = pos.z
    })
end

function Dispense( obj )
	local pos = obj.getPosition()
	local originalLockStatus = ObjectLockStates[obj.getGUID()] or false
	
	ObjectLockStates[obj.getGUID()] = nil
	
    obj.setPosition({
        x = pos.x,
        y = pos.y + ConceiledStorageOffset,
        z = pos.z
    })
	
    obj.interactable = true
	obj.setLock( originalLockStatus or false )
end