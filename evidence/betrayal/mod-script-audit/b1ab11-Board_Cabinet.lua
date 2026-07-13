function onLoad()
    self.interactable = false;
    self.createButton({
    label = "",
    click_function = "onButtonClick",
    function_owner = self,
    width = 1000,
    height = 750,
    color = {1, 0, 0, 0.0},
    position = {0, 40.7, 32.8},
    rotation = {-90, 0, 0},
    font_size = 200
    })
end

function onButtonClick()
    self.setState( 1 + (self.getStateId() % 2) )

end