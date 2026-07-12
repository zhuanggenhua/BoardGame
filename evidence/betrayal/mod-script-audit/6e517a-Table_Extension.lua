function onLoad()
    self.interactable = false;
    self.createButton({
    label = "",
    click_function = "onButtonClick",
    function_owner = self,
    width = 5000,
    height = 1000,
    color = {0, 0, 0, 0.0},
    position = {62.4, 40.75, 0},
    rotation = {0, 90, 90},
    font_size = 200
    })
end

function onButtonClick()
    self.setState( 1 + (self.getStateId() % 2) )

end